import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
  order_header as PrismaOrderHeader,
  order_item as PrismaOrderItem,
  OrderStatus as PrismaOrderStatus,
  OrderType as PrismaOrderType,
  product as PrismaProduct,
  person as PrismaPerson,
  sale_channel as PrismaSaleChannel,
  client_contract as PrismaClientContract,
  Role,
} from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { InventoryService } from '../inventory/inventory.service';
import { ScheduleService } from '../common/services/schedule.service';
import { SubscriptionQuotaService } from './services/subscription-quota.service';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderResponseDto } from './dto/order-response.dto';
import {
  OrderStatus as AppOrderStatus,
  OrderType as AppOrderType,
} from '../common/constants/enums';
import { CreateStockMovementDto } from '../inventory/dto/create-stock-movement.dto';
import {
  parseSortByString,
  mapOrderSortFields,
} from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';

// Definición del tipo para el payload del customer con sus relaciones anidadas
type CustomerPayload =
  | Prisma.personGetPayload<{
      include: {
        locality: true;
        zone: true;
      };
    }>
  | null
  | undefined;

// Definición del tipo para el payload del sale_channel
type SaleChannelPayload = Prisma.sale_channelGetPayload<{}> | null | undefined;

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Pedido';
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly scheduleService: ScheduleService,
    private readonly subscriptionQuotaService: SubscriptionQuotaService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Convierte un tiempo en formato HH:MM a minutos
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private mapToOrderResponseDto(
    order: Prisma.order_headerGetPayload<{
      include: {
        order_item: { include: { product: true } };
        customer: { include: { locality: true; zone: true } };
        sale_channel: true;
        customer_subscription: { include: { subscription_plan: true } };
        client_contract: true;
        zone: true;
        payment_transaction: {
          include: {
            payment_method: true;
          };
        };
      };
    }>,
  ): OrderResponseDto {
    const items =
      order.order_item?.map((item) => {
        // Para órdenes híbridas, verificar si el producto está en el plan de suscripción
        let abono_id: number | undefined;
        let abono_name: string | undefined;

        if (
          order.order_type === 'HYBRID' &&
          order.customer_subscription?.subscription_plan
        ) {
          const subscriptionPlan =
            order.customer_subscription.subscription_plan;
          abono_id = subscriptionPlan.subscription_plan_id;
          abono_name = subscriptionPlan.name;
        }

        return {
          order_item_id: item.order_item_id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price.toString(),
          subtotal: item.subtotal.toString(),
          delivered_quantity: item.delivered_quantity || undefined,
          returned_quantity: item.returned_quantity || undefined,
          price_list_id: item.price_list_id || undefined,
          notes: item.notes || undefined,
          abono_id,
          abono_name,
          product: {
            product_id: item.product.product_id,
            description: item.product.description,
            price: item.product.price.toString(),
            is_returnable: item.product.is_returnable,
          },
        };
      }) || [];

    const customerPayload: CustomerPayload = order.customer;
    const saleChannelPayload: SaleChannelPayload = order.sale_channel;

    let customerResponsePart: any = { person_id: 0, name: '', phone: '' };
    if (customerPayload) {
      customerResponsePart = {
        person_id: customerPayload.person_id,
        name: customerPayload.name || '',
        phone: customerPayload.phone,
        locality: customerPayload.locality
          ? {
              locality_id: customerPayload.locality.locality_id,
              name: customerPayload.locality.name || '',
            }
          : undefined,
        zone: customerPayload.zone
          ? {
              zone_id: customerPayload.zone.zone_id,
              name: customerPayload.zone.name || '',
            }
          : undefined,
      };
    }

    let saleChannelResponsePart: any = { sale_channel_id: 0, name: '' };
    if (saleChannelPayload) {
      saleChannelResponsePart = {
        sale_channel_id: saleChannelPayload.sale_channel_id,
        name: saleChannelPayload.description || '',
      };
    }

    // Calcular información de pagos
    const totalAmount = new Decimal(order.total_amount);
    const paidAmount = new Decimal(order.paid_amount);
    const remainingAmount = totalAmount.minus(paidAmount);

    // Determinar payment_status
    let paymentStatus = 'PENDING';
    if (paidAmount.equals(0)) {
      paymentStatus = 'PENDING';
    } else if (paidAmount.greaterThanOrEqualTo(totalAmount)) {
      paymentStatus = 'PAID';
    } else {
      paymentStatus = 'PARTIAL';
    }

    // Calcular traffic_light_status basado en días desde creación
    const orderDate = new Date(order.order_date);
    const currentDate = new Date();
    const daysDifference = Math.floor(
      (currentDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let trafficLightStatus = 'green';
    if (daysDifference > 7) {
      trafficLightStatus = 'red';
    } else if (daysDifference > 3) {
      trafficLightStatus = 'yellow';
    }

    // Mapear historial de pagos
    const payments = order.payment_transaction?.map((payment) => ({
      payment_id: payment.transaction_id,
      amount: payment.transaction_amount.toString(),
      payment_date: payment.transaction_date.toISOString(),
      payment_method: payment.payment_method?.description || 'No especificado',
      transaction_reference: payment.receipt_number || undefined,
      notes: payment.notes || undefined,
    })) || [];

    return {
      order_id: order.order_id,
      customer_id: order.customer_id,
      contract_id: order.contract_id ?? undefined,
      subscription_id: order.subscription_id ?? undefined,
      sale_channel_id: order.sale_channel_id,
      order_date: order.order_date.toISOString(),
      scheduled_delivery_date: order.scheduled_delivery_date
        ? order.scheduled_delivery_date.toISOString()
        : undefined,
      delivery_time: order.delivery_time || undefined,
      total_amount: order.total_amount.toString(),
      paid_amount: order.paid_amount.toString(),
      order_type: order.order_type as unknown as AppOrderType,
      status: order.status as unknown as AppOrderStatus,
      notes: order.notes ?? undefined,
      delivery_address: customerPayload?.address ?? undefined,
      order_item: items,
      customer: customerResponsePart,
      sale_channel: saleChannelResponsePart,
      zone: order.zone
        ? {
            zone_id: order.zone.zone_id,
            name: order.zone.name || '',
          }
        : undefined,
      payment_status: paymentStatus,
      remaining_amount: remainingAmount.toString(),
      traffic_light_status: trafficLightStatus,
      payments: payments,
    };
  }

  private async validateOrderData(
    createOrderDto: CreateOrderDto,
    tx: Prisma.TransactionClient,
    user?: any,
  ) {
    const prisma = tx || this;
    const customer = await prisma.person.findUnique({
      where: { person_id: createOrderDto.customer_id },
    });
    if (!customer)
      throw new NotFoundException(
        `Cliente con ID ${createOrderDto.customer_id} no encontrado.`,
      );

    const saleChannel = await prisma.sale_channel.findUnique({
      where: { sale_channel_id: createOrderDto.sale_channel_id },
    });
    if (!saleChannel)
      throw new NotFoundException(
        `Canal de venta con ID ${createOrderDto.sale_channel_id} no encontrado.`,
      );

    if (createOrderDto.contract_id) {
      const contract = await prisma.client_contract.findUnique({
        where: { contract_id: createOrderDto.contract_id },
      });
      if (!contract)
        throw new NotFoundException(
          `Contrato con ID ${createOrderDto.contract_id} no encontrado.`,
        );
      if (contract.person_id !== createOrderDto.customer_id)
        throw new BadRequestException(
          'El contrato no pertenece al cliente especificado.',
        );
    }

    if (createOrderDto.subscription_id) {
      const subscription = await prisma.customer_subscription.findUnique({
        where: { subscription_id: createOrderDto.subscription_id },
      });
      if (!subscription)
        throw new NotFoundException(
          `Suscripción con ID ${createOrderDto.subscription_id} no encontrada.`,
        );
      if (subscription.customer_id !== createOrderDto.customer_id)
        throw new BadRequestException(
          'La suscripción no pertenece al cliente especificado.',
        );
    }

    // 🆕 CORRECCIÓN: Para órdenes HYBRID, no validar paid_amount aquí
    // porque se establecerá a 0 más adelante en el proceso
    if (createOrderDto.order_type !== 'HYBRID') {
      const totalAmount = new Decimal(createOrderDto.total_amount);
      const paidAmount = new Decimal(createOrderDto.paid_amount);
      if (paidAmount.greaterThan(totalAmount))
        throw new BadRequestException(
          'El monto pagado no puede ser mayor al monto total del pedido.',
        );
    }

    if (createOrderDto.scheduled_delivery_date) {
      const orderDate = new Date(createOrderDto.order_date);
      const deliveryDate = new Date(createOrderDto.scheduled_delivery_date);

      // Para pedidos híbridos, permitir fecha de inicio igual a fecha de entrega
      if (createOrderDto.order_type === 'HYBRID') {
        // Validar que la fecha de entrega no sea anterior a la fecha del pedido
        if (deliveryDate < orderDate) {
          throw new BadRequestException(
            'La fecha de entrega programada debe ser igual o posterior a la fecha del pedido.',
          );
        }

        // Si es el mismo día, validar que el horario de entrega sea posterior al horario actual
        if (deliveryDate.toDateString() === orderDate.toDateString()) {
          if (createOrderDto.delivery_time) {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            // Para órdenes híbridas, validar el horario final del rango
            // Para otros tipos, validar el horario inicial
            let timeToValidate = createOrderDto.delivery_time;
            if (createOrderDto.delivery_time.includes('-')) {
              const [startTime, endTime] = createOrderDto.delivery_time
                .split('-')
                .map((t) => t.trim());

              // Si es orden híbrida, usar horario final; si no, usar horario inicial
              if (createOrderDto.order_type === 'HYBRID') {
                timeToValidate = endTime;
              } else {
                timeToValidate = startTime;
              }
            }

            // Convertir a minutos para comparar
            const currentMinutes = this.timeToMinutes(currentTime);
            const deliveryMinutes = this.timeToMinutes(timeToValidate);

            if (deliveryMinutes <= currentMinutes) {
              const validationType =
                createOrderDto.order_type === 'HYBRID' ? 'final' : 'inicial';
              throw new BadRequestException(
                `Para entregas el mismo día, el horario ${validationType} de entrega debe ser posterior al horario actual.`,
              );
            }
          }
        }
      } else {
        // Para otros tipos de pedido, mantener la validación original
        if (deliveryDate < orderDate) {
          throw new BadRequestException(
            'La fecha de entrega programada debe ser igual o posterior a la fecha del pedido.',
          );
        }
      }
    }

    // Validar horario usando el servicio de schedule
    if (createOrderDto.scheduled_delivery_date) {
      const orderDate = new Date(createOrderDto.order_date);
      const deliveryDate = new Date(createOrderDto.scheduled_delivery_date);

      // Permitir fechas pasadas solo para SUPERADMIN
      const allowPastDates = user?.role === Role.SUPERADMIN;

      const scheduleResult = this.scheduleService.validateOrderSchedule(
        orderDate,
        deliveryDate,
        createOrderDto.delivery_time,
        allowPastDates,
      );

      if (!scheduleResult.isValid) {
        throw new BadRequestException(scheduleResult.message);
      }
    }
  }

  async create(
    createOrderDto: CreateOrderDto,
    user?: any,
  ): Promise<OrderResponseDto> {
    try {
      return await this.$transaction(async (prismaTx) => {
        await this.validateOrderData(createOrderDto, prismaTx, user);

        const {
          customer_id,
          sale_channel_id,
          items,
          subscription_id,
          contract_id,
          total_amount: dtoTotalAmountStr,
          paid_amount: dtoPaidAmountStr,
          ...restOfDto
        } = createOrderDto;

        let calculatedTotalFromDB = new Decimal(0);
        const orderItemsDataForCreation: Prisma.order_itemUncheckedCreateWithoutOrder_headerInput[] =
          [];

        // Si hay contrato, obtener la lista de precios del contrato
        let contractPriceList: {
          price_list_item: {
            product_id: number;
            price_list_item_id: number;
            unit_price: any;
          }[];
        } | null = null;
        if (contract_id) {
          const contract = await prismaTx.client_contract.findUnique({
            where: { contract_id },
            include: {
              price_list: {
                include: {
                  price_list_item: true,
                },
              },
            },
          });

          if (!contract) {
            throw new NotFoundException(
              `Contrato con ID ${contract_id} no encontrado.`,
            );
          }

          contractPriceList = contract.price_list;
        }

        // 🆕 NUEVO: Validación de cuotas de suscripción
        let subscriptionQuotaValidation: any = null;
        if (
          subscription_id &&
          (createOrderDto.order_type === 'HYBRID' ||
            createOrderDto.order_type === 'SUBSCRIPTION')
        ) {
          subscriptionQuotaValidation =
            await this.subscriptionQuotaService.validateSubscriptionQuotas(
              subscription_id,
              items.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
              })),
              prismaTx,
            );

          // Para órdenes SUBSCRIPTION puras, no puede haber productos adicionales
          if (
            createOrderDto.order_type === 'SUBSCRIPTION' &&
            subscriptionQuotaValidation.has_additional_charges
          ) {
            throw new BadRequestException(
              'Las órdenes de tipo SUBSCRIPTION no pueden contener productos adicionales. Use tipo HYBRID para incluir productos adicionales.',
            );
          }
        }

        for (const itemDto of items) {
          const productDetails = await prismaTx.product
            .findUniqueOrThrow({
              where: { product_id: itemDto.product_id },
            })
            .catch(() => {
              throw new NotFoundException(
                `Producto con ID ${itemDto.product_id} no encontrado.`,
              );
            });

          console.log(
            `\n🆕 PROCESANDO PRODUCTO: ${itemDto.product_id} (${productDetails.description})`,
          );

          let itemPrice = new Decimal(productDetails.price); // Precio base por defecto
          let itemSubtotal = new Decimal(0);
          let usedPriceListId: number | null = null;

          if (itemDto.price_list_id) {
            // ✅ PRIORIDAD 1: Lista de precios específica del producto
            const customPriceItem = await prismaTx.price_list_item.findFirst({
              where: {
                price_list_id: itemDto.price_list_id,
                product_id: itemDto.product_id,
              },
            });

            if (customPriceItem) {
              itemPrice = new Decimal(customPriceItem.unit_price);
              usedPriceListId = itemDto.price_list_id;
            } else {
              throw new BadRequestException(
                `El producto ${productDetails.description} (ID: ${itemDto.product_id}) no está disponible en la lista de precios especificada (ID: ${itemDto.price_list_id}).`,
              );
            }

            itemSubtotal = itemPrice.mul(itemDto.quantity);
          } else if (
            subscriptionQuotaValidation &&
            (createOrderDto.order_type === 'HYBRID' ||
              createOrderDto.order_type === 'SUBSCRIPTION')
          ) {
            // 🆕 PRIORIDAD 2: Órdenes con suscripción - usar control de cuotas
            const productQuota = subscriptionQuotaValidation.products.find(
              (quota) => quota.product_id === itemDto.product_id,
            );

            if (!productQuota) {
              throw new BadRequestException(
                `Error interno: No se encontró información de cuota para el producto ${itemDto.product_id}.`,
              );
            }

            // 🆕 DEBUG: Log para entender el cálculo
            console.log(
              `DEBUG - Producto ${itemDto.product_id} (${productDetails.description}):`,
            );
            console.log(`  - Cantidad pedida: ${itemDto.quantity}`);
            console.log(
              `  - Cubierto por suscripción: ${productQuota.covered_by_subscription}`,
            );
            console.log(
              `  - Cantidad adicional: ${productQuota.additional_quantity}`,
            );
            console.log(
              `  - Precio base del producto: ${productDetails.price}`,
            );
            console.log(
              `  - ¿Está en plan de suscripción?: ${productQuota.covered_by_subscription > 0 ? 'SÍ' : 'NO'}`,
            );
            console.log(
              `  - ¿Tiene cantidad adicional?: ${productQuota.additional_quantity > 0 ? 'SÍ' : 'NO'}`,
            );

            // Calcular precio basado en cuotas
            if (productQuota.covered_by_subscription > 0) {
              // Producto está en el plan de suscripción

              // Si hay cantidad adicional, calcular su precio
              if (productQuota.additional_quantity > 0) {
                let additionalPrice = new Decimal(productDetails.price); // Precio base por defecto

                // 🆕 REGLA ESPECIAL: Productos que ESTÁN en suscripción pero exceden cuota
                // → SIEMPRE usan lista general (no permiten price_list_id específica)
                const standardPriceItem =
                  await prismaTx.price_list_item.findFirst({
                    where: {
                      price_list_id:
                        BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
                      product_id: itemDto.product_id,
                    },
                  });

                if (standardPriceItem) {
                  additionalPrice = new Decimal(standardPriceItem.unit_price);
                  usedPriceListId =
                    BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                }
                // Si el producto no está en la lista general, usa precio base del producto

                // 🆕 CORRECCIÓN: Solo cobrar por la cantidad adicional, no por el total
                // La cantidad cubierta por suscripción tiene precio $0
                // Solo la cantidad adicional se cobra al precio normal
                itemPrice = additionalPrice; // Precio por unidad adicional
                itemSubtotal = additionalPrice.mul(
                  productQuota.additional_quantity,
                );

                console.log(
                  `  - Precio por unidad adicional: ${additionalPrice}`,
                );
                console.log(`  - Subtotal calculado: ${itemSubtotal}`);
              } else {
                // Todo está cubierto por suscripción
                itemPrice = new Decimal(0);
                itemSubtotal = new Decimal(0);
                console.log(`  - Todo cubierto por suscripción, subtotal: $0`);
              }
            } else {
              // Todo el producto es adicional (no está en el plan o no hay créditos)
              console.log(
                `DEBUG - Producto ${itemDto.product_id} (${productDetails.description}) NO está en plan de suscripción:`,
              );
              console.log(`  - Cantidad pedida: ${itemDto.quantity}`);
              console.log(
                `  - Precio base del producto: ${productDetails.price}`,
              );

              if (itemDto.price_list_id) {
                const customPriceItem =
                  await prismaTx.price_list_item.findFirst({
                    where: {
                      price_list_id: itemDto.price_list_id,
                      product_id: itemDto.product_id,
                    },
                  });

                if (customPriceItem) {
                  itemPrice = new Decimal(customPriceItem.unit_price);
                  usedPriceListId = itemDto.price_list_id;
                  console.log(
                    `  - Usando lista de precios específica: ${customPriceItem.unit_price}`,
                  );
                } else {
                  throw new BadRequestException(
                    `El producto ${productDetails.description} (ID: ${itemDto.product_id}) no está disponible en la lista de precios especificada (ID: ${itemDto.price_list_id}).`,
                  );
                }
              } else {
                const standardPriceItem =
                  await prismaTx.price_list_item.findFirst({
                    where: {
                      price_list_id:
                        BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
                      product_id: itemDto.product_id,
                    },
                  });

                if (standardPriceItem) {
                  itemPrice = new Decimal(standardPriceItem.unit_price);
                  usedPriceListId =
                    BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
                  console.log(
                    `  - Usando lista de precios estándar: ${standardPriceItem.unit_price}`,
                  );
                } else {
                  console.log(
                    `  - Usando precio base del producto: ${productDetails.price}`,
                  );
                }
              }
              itemSubtotal = itemPrice.mul(itemDto.quantity);
              console.log(`  - Subtotal calculado: ${itemSubtotal}`);
            }

            // 🆕 NUEVO: Agregar el ítem al array de creación después de procesar suscripción
            console.log(`  - DEBUG ANTES DE AGREGAR AL ARRAY:`);
            console.log(`    - itemPrice: ${itemPrice}`);
            console.log(`    - itemSubtotal: ${itemSubtotal}`);
            console.log(`    - usedPriceListId: ${usedPriceListId}`);

            // 🆕 IMPORTANTE: Actualizar el total antes de continuar
            calculatedTotalFromDB = calculatedTotalFromDB.plus(itemSubtotal);
            console.log(
              `  - Subtotal final para este producto: ${itemSubtotal}`,
            );
            console.log(
              `  - Total acumulado hasta ahora: ${calculatedTotalFromDB}`,
            );

            orderItemsDataForCreation.push({
              product_id: itemDto.product_id,
              quantity: itemDto.quantity,
              unit_price: itemPrice.toString(),
              subtotal: itemSubtotal.toString(),
              price_list_id: usedPriceListId,
              notes: itemDto.notes,
            });

            console.log(
              `  - ✅ Producto agregado al array de creación: ${itemDto.product_id} - Subtotal: ${itemSubtotal}`,
            );

            // 🆕 IMPORTANTE: Continuar al siguiente producto después de procesar suscripción
            continue;
          } else if (contractPriceList) {
            // ✅ PRIORIDAD 3: Cliente con contrato → usar lista de precios del contrato
            const priceListItem = contractPriceList.price_list_item.find(
              (item) => item.product_id === itemDto.product_id,
            );

            if (priceListItem) {
              itemPrice = new Decimal(priceListItem.unit_price);
              usedPriceListId =
                contractPriceList.price_list_item[0]?.price_list_item_id ||
                null;
            } else {
              throw new BadRequestException(
                `El producto ${productDetails.description} (ID: ${itemDto.product_id}) no está disponible en la lista de precios del contrato.`,
              );
            }
            itemSubtotal = itemPrice.mul(itemDto.quantity);

            console.log(
              `  - ✅ Producto agregado al array de creación (contrato): ${itemDto.product_id} - Subtotal: ${itemSubtotal}`,
            );
          } else {
            // ✅ PRIORIDAD 4: Lista de precios estándar → último recurso
            const standardPriceItem = await prismaTx.price_list_item.findFirst({
              where: {
                price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
                product_id: itemDto.product_id,
              },
            });

            if (standardPriceItem) {
              itemPrice = new Decimal(standardPriceItem.unit_price);
              usedPriceListId = BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
            }
            // Si no hay precio en lista estándar, usa precio base (itemPrice ya está configurado)
            itemSubtotal = itemPrice.mul(itemDto.quantity);
          }

          calculatedTotalFromDB = calculatedTotalFromDB.plus(itemSubtotal);

          console.log(`  - Subtotal final para este producto: ${itemSubtotal}`);
          console.log(
            `  - Total acumulado hasta ahora: ${calculatedTotalFromDB}`,
          );

          // 🆕 NUEVO: Incluir price_list_id y notes en los datos del ítem
          orderItemsDataForCreation.push({
            product_id: itemDto.product_id,
            quantity: itemDto.quantity,
            unit_price: itemPrice.toString(),
            subtotal: itemSubtotal.toString(),
            price_list_id: usedPriceListId,
            notes: itemDto.notes,
          });

          console.log(
            `  - ✅ Producto agregado al array de creación: ${itemDto.product_id} - Subtotal: ${itemSubtotal}`,
          );
        }

        console.log(`\n🆕 RESUMEN: Se procesaron ${items.length} productos`);
        console.log(`🆕 PRODUCTOS PROCESADOS:`);
        orderItemsDataForCreation.forEach((item, index) => {
          console.log(
            `  ${index + 1}. Producto ${item.product_id}: ${item.quantity} unidades, Subtotal: ${item.subtotal}`,
          );
        });

        // 🆕 NUEVO: Aplicar recargo por mora del 20% si corresponde
        let lateFeeAmount = new Decimal(0);
        if (
          subscriptionQuotaValidation?.late_fee_info?.is_overdue &&
          subscriptionQuotaValidation?.late_fee_info?.late_fee_applied &&
          subscriptionQuotaValidation?.late_fee_info?.late_fee_percentage > 0
        ) {
          const lateFeePercentage = new Decimal(
            subscriptionQuotaValidation.late_fee_info.late_fee_percentage,
          );
          lateFeeAmount = calculatedTotalFromDB.mul(lateFeePercentage).div(100);
          calculatedTotalFromDB = calculatedTotalFromDB.plus(lateFeeAmount);

          console.log(`🚨 RECARGO POR MORA APLICADO:`);
          console.log(`  - Porcentaje de recargo: ${lateFeePercentage}%`);
          console.log(`  - Monto del recargo: $${lateFeeAmount}`);
          console.log(
            `  - Fecha de vencimiento: ${subscriptionQuotaValidation.late_fee_info.payment_due_date}`,
          );
        }

        console.log(`🆕 DEBUG FINAL:`);
        console.log(
          `  - Total calculado desde BD (sin recargo): ${calculatedTotalFromDB.minus(lateFeeAmount)}`,
        );
        console.log(`  - Recargo por mora: $${lateFeeAmount}`);
        console.log(`  - Total final (con recargo): ${calculatedTotalFromDB}`);
        console.log(`  - Total enviado desde frontend: ${dtoTotalAmountStr}`);
        console.log(`  - Tipo de orden: ${createOrderDto.order_type}`);
        console.log(`  - ID de suscripción: ${subscription_id}`);

   
        let finalPaidAmount: Decimal;
        if (createOrderDto.order_type === 'HYBRID' || createOrderDto.order_type === 'ONE_OFF') {
          finalPaidAmount = new Decimal('0');
          console.log(`🆕 ${createOrderDto.order_type} ORDER: Estableciendo paid_amount = 0 (ignorando valor del frontend: ${dtoPaidAmountStr})`);
        } else {
          finalPaidAmount = new Decimal(dtoPaidAmountStr || '0');
        }
        
        if (finalPaidAmount.greaterThan(calculatedTotalFromDB)) {
          throw new BadRequestException(
            'El monto pagado no puede ser mayor al monto total del pedido calculado.',
          );
        }

        // Para órdenes de suscripción, permitir total_amount = 0 porque ya están pagadas
        if (createOrderDto.order_type === 'SUBSCRIPTION' && subscription_id) {
          if (calculatedTotalFromDB.greaterThan(0)) {
            throw new BadRequestException(
              'Las órdenes de suscripción deben tener total_amount = 0 porque ya están pagadas en el plan.',
            );
          }
        } else if (createOrderDto.order_type === 'HYBRID' && subscription_id) {
          // 🆕 NUEVO: Para órdenes HYBRID con suscripción, validar que el total coincida
          // pero permitir que el frontend envíe 0 si no calcula correctamente
          if (
            dtoTotalAmountStr &&
            !new Decimal(dtoTotalAmountStr).equals(calculatedTotalFromDB)
          ) {
            console.log(
              `⚠️ ADVERTENCIA: Total del frontend (${dtoTotalAmountStr}) no coincide con el calculado (${calculatedTotalFromDB}). Usando el calculado.`,
            );
            // No lanzar error, usar el total calculado
          }
        } else {
          // Para otros tipos de orden, validar que el total coincida
          if (
            dtoTotalAmountStr &&
            !new Decimal(dtoTotalAmountStr).equals(calculatedTotalFromDB)
          ) {
            throw new BadRequestException(
              `El total_amount enviado (${dtoTotalAmountStr}) no coincide con el calculado desde la base de datos (${calculatedTotalFromDB.toString()}). Verifique los precios y cantidades.`,
            );
          }
        }

        const saleMovementTypeId =
          await this.inventoryService.getMovementTypeIdByCode(
            BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_PRODUCTO,
            prismaTx,
          );

        for (const itemDto of items) {
          const productDetails = await prismaTx.product.findUniqueOrThrow({
            where: { product_id: itemDto.product_id },
          });

          // 🆕 CORRECCIÓN: Solo validar stock para productos NO retornables
          // Los productos retornables no necesitan validación de stock porque no se descuenta del inventario
          if (!productDetails.is_returnable) {
            let quantityToValidate = itemDto.quantity;

            if (
              subscriptionQuotaValidation &&
              subscription_id &&
              (createOrderDto.order_type === 'HYBRID' ||
                createOrderDto.order_type === 'SUBSCRIPTION')
            ) {
              const productQuota = subscriptionQuotaValidation.products.find(
                (quota) => quota.product_id === itemDto.product_id,
              );

              if (productQuota && productQuota.covered_by_subscription > 0) {
                // Producto está en suscripción - solo validar la cantidad adicional
                quantityToValidate = productQuota.additional_quantity;
                console.log(
                  `🆕 STOCK VALIDATION - Producto ${itemDto.product_id} (${productDetails.description}):`,
                );
                console.log(`  - Cantidad total pedida: ${itemDto.quantity}`);
                console.log(
                  `  - Cubierto por suscripción: ${productQuota.covered_by_subscription}`,
                );
                console.log(
                  `  - Cantidad adicional a validar: ${quantityToValidate}`,
                );
              }
            }

            const stockDisponible = await this.inventoryService.getProductStock(
              itemDto.product_id,
              BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
              prismaTx,
            );

            if (
              quantityToValidate > 0 &&
              stockDisponible < quantityToValidate
            ) {
              throw new BadRequestException(
                `${this.entityName}: Stock insuficiente para el producto ${productDetails.description} (ID: ${itemDto.product_id}). Disponible: ${stockDisponible}, Solicitado: ${quantityToValidate}.`,
              );
            }

            console.log(
              `✅ Stock validado para producto NO retornable: ${productDetails.description} (Disponible: ${stockDisponible}, Solicitado: ${quantityToValidate})`,
            );
          } else {
            console.log(
              `🔄 Producto retornable ${productDetails.description} - No se valida stock porque no se descuenta del inventario`,
            );
          }
        }

        const newOrderHeader = await prismaTx.order_header.create({
          data: {
            ...restOfDto,
            order_date: restOfDto.order_date
              ? new Date(restOfDto.order_date)
              : new Date(),
            scheduled_delivery_date: restOfDto.scheduled_delivery_date
              ? new Date(restOfDto.scheduled_delivery_date)
              : undefined,
            total_amount: calculatedTotalFromDB.toString(),
            paid_amount: finalPaidAmount.toString(),
            status:
              (restOfDto.status as PrismaOrderStatus) ||
              PrismaOrderStatus.PENDING,
            customer: { connect: { person_id: customer_id } },
            sale_channel: { connect: { sale_channel_id: sale_channel_id } },
            order_type: restOfDto.order_type as PrismaOrderType,
            ...(subscription_id && {
              customer_subscription: { connect: { subscription_id } },
            }),
            ...(contract_id && {
              client_contract: { connect: { contract_id } },
            }),
            order_item: {
              createMany: {
                data: orderItemsDataForCreation,
              },
            },
          },
          include: {
            order_item: { include: { product: true } },
            customer: { include: { locality: true, zone: true } },
            sale_channel: true,
            customer_subscription: { include: { subscription_plan: true } },
            client_contract: true,
            zone: true,
            payment_transaction: {
              include: {
                payment_method: true,
              },
            },
          },
        });

        for (const createdItem of newOrderHeader.order_item) {
          const productDesc = createdItem.product
            ? createdItem.product.description
            : 'N/A';

          // 🔧 CORRECCIÓN: Crear movimientos de stock para TODOS los productos
          // SIEMPRE se debe restar el stock, independientemente del tipo de orden o abono
          let quantityForStockMovement = createdItem.quantity;

          // Solo para órdenes de suscripción pura, ajustar la cantidad según las cuotas
          if (
            subscriptionQuotaValidation &&
            subscription_id &&
            createOrderDto.order_type === 'SUBSCRIPTION'
          ) {
            const productQuota = subscriptionQuotaValidation.products.find(
              (quota) => quota.product_id === createdItem.product_id,
            );

            if (productQuota && productQuota.covered_by_subscription > 0) {
              // Para órdenes SUBSCRIPTION puras, solo la cantidad adicional afecta el stock
              quantityForStockMovement = productQuota.additional_quantity;
              console.log(
                `🆕 STOCK MOVEMENT (SUBSCRIPTION) - Producto ${createdItem.product_id} (${productDesc}):`,
              );
              console.log(
                `  - Cantidad total en orden: ${createdItem.quantity}`,
              );
              console.log(
                `  - Cubierto por suscripción: ${productQuota.covered_by_subscription}`,
              );
              console.log(
                `  - Cantidad adicional: ${productQuota.additional_quantity}`,
              );
              console.log(
                `  - Cantidad para movimiento de stock: ${quantityForStockMovement}`,
              );
            }
          }
          // Para órdenes HYBRID, ONE_OFF, o cualquier otra, SIEMPRE restar toda la cantidad
          else {
            console.log(
              `🆕 STOCK MOVEMENT (${createOrderDto.order_type || 'ONE_OFF'}) - Producto ${createdItem.product_id} (${productDesc}):`,
            );
            console.log(
              `  - Cantidad total para movimiento de stock: ${quantityForStockMovement}`,
            );
            console.log(`  - Abono: ${finalPaidAmount.toString()}`);
          }

          // 🆕 CORRECCIÓN: Crear movimiento de stock SOLO para productos NO retornables
          if (
            quantityForStockMovement > 0 &&
            !createdItem.product.is_returnable
          ) {
            const stockMovementDto: CreateStockMovementDto = {
              movement_type_id: saleMovementTypeId,
              product_id: createdItem.product_id,
              quantity: quantityForStockMovement,
              source_warehouse_id:
                BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
              destination_warehouse_id: null,
              movement_date: new Date(),
              remarks: `${this.entityName} #${newOrderHeader.order_id} - Producto ${productDesc} (ID ${createdItem.product_id}) NO retornable - Abono: $${finalPaidAmount.toString()}`,
            };
            await this.inventoryService.createStockMovement(
              stockMovementDto,
              prismaTx,
            );
            console.log(
              `✅ Movimiento de stock creado: ${quantityForStockMovement} unidades de ${productDesc} (NO retornable) - Abono: $${finalPaidAmount.toString()}`,
            );
          } else if (
            quantityForStockMovement > 0 &&
            createdItem.product.is_returnable
          ) {
            console.log(
              `⏭️ No se crea movimiento de stock para ${productDesc} - producto RETORNABLE (préstamo)`,
            );
          } else {
            console.log(
              `⏭️ No se crea movimiento de stock para ${productDesc} - cantidad: ${quantityForStockMovement}`,
            );
          }
        }

        // 🆕 NUEVO: Actualizar cantidades entregadas en ciclo de suscripción
        if (subscriptionQuotaValidation && subscription_id) {
          const deliveredProducts = subscriptionQuotaValidation.products
            .filter((quota) => quota.covered_by_subscription > 0)
            .map((quota) => ({
              product_id: quota.product_id,
              quantity: quota.covered_by_subscription,
            }));

          if (deliveredProducts.length > 0) {
            await this.subscriptionQuotaService.updateDeliveredQuantities(
              subscription_id,
              deliveredProducts,
              prismaTx,
            );
          }
        }

        return this.mapToOrderResponseDto(newOrderHeader);
      });
    } catch (error) {
      handlePrismaError(error, this.entityName);
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          'Error no manejado después de handlePrismaError en create order.',
        );
      }
      throw error;
    }
  }

  async validateCustomerExists(customerId: number): Promise<void> {
    try {
      const customer = await this.person.findUniqueOrThrow({
        where: { person_id: customerId },
      });
    } catch (error) {
      handlePrismaError(error, 'Cliente');
      throw new NotFoundException(
        `Cliente con ID ${customerId} no encontrado.`,
      );
    }
  }

  async findAll(filterDto: FilterOrdersDto): Promise<{
    data: OrderResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      search,
      customerName,
      orderDateFrom,
      orderDateTo,
      deliveryDateFrom,
      deliveryDateTo,
      status,
      statuses,
      orderType,
      orderTypes,
      customerId,
      customerIds,
      orderId,
      zoneId,
      zoneIds,
      vehicleId,
      vehicleIds,
      page = 1,
      limit = 10,
      sortBy,
    } = filterDto;

    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);
    const where: Prisma.order_headerWhereInput = {
      is_active: true, // Solo mostrar pedidos activos
    };

    if (orderId) where.order_id = orderId;

    // Manejar filtrado por estados (múltiples o único)
    if (statuses && statuses.length > 0) {
      // Si se proporcionan múltiples estados, usar operador IN
      where.status = { in: statuses as PrismaOrderStatus[] };
    } else if (status) {
      // Si solo se proporciona un estado (compatibilidad), usar equality
      where.status = status as PrismaOrderStatus;
    }

    // Manejar filtrado por tipos de orden (múltiples o único)
    if (orderTypes && orderTypes.length > 0) {
      // Si se proporcionan múltiples tipos, usar operador IN
      where.order_type = { in: orderTypes as PrismaOrderType[] };
    } else if (orderType) {
      // Si solo se proporciona un tipo (compatibilidad), usar equality
      where.order_type = orderType as PrismaOrderType;
    }

    // Manejar filtrado por IDs de clientes (múltiples o único)
    if (customerIds && customerIds.length > 0) {
      // Si se proporcionan múltiples IDs de clientes, usar operador IN
      where.customer_id = { in: customerIds };
    } else if (customerId) {
      // Si solo se proporciona un ID de cliente (compatibilidad), usar equality
      where.customer_id = customerId;
    }

    const customerConditions: Prisma.personWhereInput[] = [];
    if (customerName) {
      customerConditions.push({
        name: { contains: customerName, mode: 'insensitive' },
      });
    }

    // Manejar filtrado por zonas del cliente (múltiples o única)
    if (zoneIds && zoneIds.length > 0) {
      // Si se proporcionan múltiples zonas, usar operador IN
      customerConditions.push({ zone_id: { in: zoneIds } });
    } else if (zoneId) {
      // Si solo se proporciona una zona (compatibilidad), usar equality
      customerConditions.push({ zone_id: zoneId });
    }

    if (customerConditions.length > 0) {
      where.customer = {
        OR: customerConditions.length > 1 ? customerConditions : undefined,
        AND:
          customerConditions.length === 1 ? customerConditions[0] : undefined,
      };
    }

    // Manejar filtrado por vehículos (múltiples o único)
    if (vehicleIds && vehicleIds.length > 0) {
      // Si se proporcionan múltiples vehículos, usar operador IN
      where.route_sheet_detail = {
        some: {
          route_sheet: {
            vehicle_id: { in: vehicleIds },
          },
        },
      };
    } else if (vehicleId) {
      // Si solo se proporciona un vehículo (compatibilidad), usar equality
      where.route_sheet_detail = {
        some: {
          route_sheet: {
            vehicle_id: vehicleId,
          },
        },
      };
    }

    if (search) {
      const searchAsNumber = !isNaN(parseInt(search))
        ? parseInt(search)
        : undefined;
      const orConditions: Prisma.order_headerWhereInput[] = [];
      orConditions.push({
        customer: {
          name: { contains: search, mode: 'insensitive' },
        },
      });
      if (searchAsNumber) {
        orConditions.push({ order_id: searchAsNumber });
      }
      if (where.OR) {
        where.OR = where.OR.concat(orConditions);
      } else {
        where.OR = orConditions;
      }
    }

    if (orderDateFrom || orderDateTo) {
      where.order_date = {};
      if (orderDateFrom) {
        const fromDate = new Date(orderDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        where.order_date.gte = fromDate;
      }
      if (orderDateTo) {
        const toDate = new Date(orderDateTo);
        toDate.setHours(23, 59, 59, 999);
        where.order_date.lte = toDate;
      }
    }

    if (deliveryDateFrom || deliveryDateTo) {
      where.scheduled_delivery_date = {};
      if (deliveryDateFrom) {
        const fromDate = new Date(deliveryDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        where.scheduled_delivery_date.gte = fromDate;
      }
      if (deliveryDateTo) {
        const toDate = new Date(deliveryDateTo);
        toDate.setHours(23, 59, 59, 999);
        where.scheduled_delivery_date.lte = toDate;
      }
    }

    const orderByClause = parseSortByString(
      sortBy,
      [{ order_date: 'desc' }],
      mapOrderSortFields,
    );

    try {
      const totalOrders = await this.order_header.count({ where });

      const orders = await this.order_header.findMany({
        where,
        include: {
          order_item: { include: { product: true } },
          customer: {
            include: {
              locality: true,
              zone: true,
            },
          },
          sale_channel: true,
          customer_subscription: { include: { subscription_plan: true } },
          client_contract: true,
          zone: true,
          payment_transaction: {
            include: {
              payment_method: true,
            },
          },
        },
        orderBy: orderByClause,
        skip,
        take,
      });

      return {
        data: orders.map((order) => this.mapToOrderResponseDto(order)),
        meta: {
          total: totalOrders,
          page,
          limit: take,
          totalPages: Math.ceil(totalOrders / take),
        },
      };
    } catch (error) {
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError en findAll orders.',
      );
    }
  }

  async findOne(id: number, includeInactive: boolean = false): Promise<OrderResponseDto> {
    try {
      const order = await this.order_header.findFirstOrThrow({
        where: { 
          order_id: id,
          ...(includeInactive ? {} : { is_active: true })
        },
        include: {
          order_item: { include: { product: true } },
          customer: { include: { locality: true, zone: true } },
          sale_channel: true,
          customer_subscription: { include: { subscription_plan: true } },
          client_contract: true,
          zone: true,
          payment_transaction: {
            include: {
              payment_method: true,
            },
            orderBy: {
              transaction_date: 'desc',
            },
          },
        },
      });
      return this.mapToOrderResponseDto(order);
    } catch (error) {
      handlePrismaError(error, this.entityName);
      if (!(error instanceof NotFoundException)) {
        throw new InternalServerErrorException(
          'Error no manejado después de handlePrismaError en findOne order.',
        );
      }
      throw error;
    }
  }

  async update(
    id: number,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    const {
      items,
      items_to_update_or_create,
      item_ids_to_delete,
      ...orderHeaderDataToUpdateInput
    } = updateOrderDto;
    const dataToUpdate: Prisma.order_headerUpdateInput = {};

    for (const key in orderHeaderDataToUpdateInput) {
      if (
        orderHeaderDataToUpdateInput[key] !== undefined &&
        key !== 'order_type' &&
        key !== 'status'
      ) {
        (dataToUpdate as any)[key] = (orderHeaderDataToUpdateInput as any)[key];
      }
    }

    if (orderHeaderDataToUpdateInput.order_type) {
      dataToUpdate.order_type = {
        set: orderHeaderDataToUpdateInput.order_type as PrismaOrderType,
      };
    }
    if (orderHeaderDataToUpdateInput.status) {
      dataToUpdate.status = {
        set: orderHeaderDataToUpdateInput.status as PrismaOrderStatus,
      };
    }

    try {
      const order = await this.$transaction(async (tx) => {
        const existingOrder = await tx.order_header
          .findUniqueOrThrow({
            where: { order_id: id },
            include: { order_item: { include: { product: true } } },
          })
          .catch(() => {
            throw new NotFoundException(
              `${this.entityName} con ID ${id} no encontrado.`,
            );
          });

        // 🆕 COMPATIBILIDAD: Procesar campo 'items' para órdenes híbridas
        if (items && items.length > 0) {
          // Eliminar todos los items existentes y crear los nuevos
          await tx.order_item.deleteMany({
            where: { order_id: id },
          });

          const saleMovementTypeId =
            await this.inventoryService.getMovementTypeIdByCode(
              BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_PRODUCTO,
              tx,
            );

          // Procesar cada item del campo 'items'
          for (const itemDto of items) {
            const productDetails = await tx.product.findUniqueOrThrow({
              where: { product_id: itemDto.product_id },
            });

            let itemPrice = new Decimal(productDetails.price);

            // Aplicar lógica de precios similar a items_to_update_or_create
            if (itemDto.price_list_id) {
              const priceItem = await tx.price_list_item.findFirst({
                where: {
                  price_list_id: itemDto.price_list_id,
                  product_id: itemDto.product_id,
                },
              });
              if (priceItem) {
                itemPrice = new Decimal(priceItem.unit_price);
              }
            }

            const quantityDecimal = new Decimal(itemDto.quantity);
            const subtotal = itemPrice.mul(quantityDecimal);

            // Validar stock para productos no retornables
            if (!productDetails.is_returnable) {
              const stockDisponible =
                await this.inventoryService.getProductStock(
                  itemDto.product_id,
                  BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                  tx,
                );
              if (stockDisponible < itemDto.quantity) {
                throw new BadRequestException(
                  `${this.entityName}: Stock insuficiente para ${productDetails.description}. Necesario: ${itemDto.quantity}, disponible: ${stockDisponible}.`,
                );
              }
            }

            // Crear el nuevo item
            await tx.order_item.create({
              data: {
                order_id: id,
                product_id: itemDto.product_id,
                quantity: itemDto.quantity,
                unit_price: itemPrice.toString(),
                subtotal: subtotal.toString(),
              },
            });

            // Crear movimiento de stock
            if (!productDetails.is_returnable) {
              await this.inventoryService.createStockMovement(
                {
                  movement_type_id: saleMovementTypeId,
                  product_id: itemDto.product_id,
                  quantity: itemDto.quantity,
                  source_warehouse_id:
                    BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                  destination_warehouse_id: null,
                  movement_date: new Date(),
                  remarks: `${this.entityName} #${id} - ${productDetails.description}`,
                },
                tx,
              );
            }
          }
        } else if (
          items_to_update_or_create &&
          items_to_update_or_create.length > 0
        ) {
          const saleMovementTypeId =
            await this.inventoryService.getMovementTypeIdByCode(
              BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_PRODUCTO,
              tx,
            );

          // Obtener información del pedido para determinar el sistema de precios
          const existingOrderWithRelations =
            await tx.order_header.findUniqueOrThrow({
              where: { order_id: id },
              include: {
                client_contract: {
                  include: {
                    price_list: {
                      include: {
                        price_list_item: true,
                      },
                    },
                  },
                },
                customer_subscription: {
                  include: {
                    subscription_plan: {
                      include: {
                        subscription_plan_product: true,
                      },
                    },
                  },
                },
              },
            });

          for (const itemDto of items_to_update_or_create) {
            const productDetails = await tx.product.findUniqueOrThrow({
              where: { product_id: itemDto.product_id },
            });

            // Calcular precio usando el mismo sistema que en create()
            let itemPrice = new Decimal(productDetails.price); // Precio base por defecto

            // Lógica de precios por prioridad: Contrato > Suscripción específica > Precio base
            if (existingOrderWithRelations.client_contract?.price_list) {
              const contractPriceList =
                existingOrderWithRelations.client_contract.price_list;
              const priceListItem = contractPriceList.price_list_item.find(
                (item) => item.product_id === itemDto.product_id,
              );

              if (priceListItem) {
                itemPrice = new Decimal(priceListItem.unit_price);
              } else {
                throw new BadRequestException(
                  `El producto ${productDetails.description} (ID: ${itemDto.product_id}) no está disponible en la lista de precios del contrato.`,
                );
              }
            } else if (
              existingOrderWithRelations.customer_subscription
                ?.subscription_plan
            ) {
              const subscriptionPlan =
                existingOrderWithRelations.customer_subscription
                  .subscription_plan;
              const planProduct =
                subscriptionPlan.subscription_plan_product.find(
                  (spp) => spp.product_id === itemDto.product_id,
                );

              if (planProduct) {
                // Producto está en el plan de suscripción → precio $0 (ya pagado en suscripción)
                itemPrice = new Decimal(0);
              } else {
                // Para órdenes SUBSCRIPTION, todos los productos deben estar en el plan
                if (existingOrderWithRelations.order_type === 'SUBSCRIPTION') {
                  throw new BadRequestException(
                    `El producto ${productDetails.description} (ID: ${itemDto.product_id}) no está incluido en el plan de suscripción.`,
                  );
                }

                // 🆕 REGLA ESPECIAL: Productos NO en plan de suscripción en órdenes HYBRID
                // → pueden usar lista específica (productos completamente adicionales)
                //
                // NOTA: En el método update() es complejo determinar cuotas exactas,
                // pero podemos aplicar la regla básica: productos del plan siempre usan lista general
                // Solo productos completamente nuevos/adicionales pueden usar listas específicas
                const standardPriceItem = await tx.price_list_item.findFirst({
                  where: {
                    price_list_id:
                      BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
                    product_id: itemDto.product_id,
                  },
                });

                if (standardPriceItem) {
                  itemPrice = new Decimal(standardPriceItem.unit_price);
                }
              }
            } else {
              // Si no hay contrato ni suscripción → usar lista de precios estándar
              const standardPriceItem = await tx.price_list_item.findFirst({
                where: {
                  price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
                  product_id: itemDto.product_id,
                },
              });

              if (standardPriceItem) {
                itemPrice = new Decimal(standardPriceItem.unit_price);
              }
            }

            const quantityDecimal = new Decimal(itemDto.quantity);
            const subtotal = itemPrice.mul(quantityDecimal);
            const totalAmountItem = subtotal;

            let quantityChange = 0;
            const existingItem = existingOrder.order_item.find(
              (oi) => oi.order_item_id === itemDto.order_item_id,
            );

            if (existingItem) {
              quantityChange = itemDto.quantity - existingItem.quantity;
            } else {
              quantityChange = itemDto.quantity;
            }

            if (quantityChange > 0 && !productDetails.is_returnable) {
              const stockDisponible =
                await this.inventoryService.getProductStock(
                  itemDto.product_id,
                  BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                  tx,
                );
              if (stockDisponible < quantityChange) {
                throw new BadRequestException(
                  `${this.entityName}: Stock insuficiente para ${productDetails.description}. Se necesita ${quantityChange} adicional, disponible: ${stockDisponible}.`,
                );
              }
            }

            const existingItemForUpdate = existingOrder.order_item.find(
              (i) => i.order_item_id === itemDto.order_item_id,
            );

            if (existingItemForUpdate) {
              quantityChange =
                itemDto.quantity - existingItemForUpdate.quantity;
              await tx.order_item.update({
                where: { order_item_id: itemDto.order_item_id },
                data: {
                  product_id: itemDto.product_id,
                  quantity: itemDto.quantity,
                  unit_price: itemPrice.toString(),
                  subtotal: subtotal.toString(),
                },
              });
            } else {
              quantityChange = itemDto.quantity;
              await tx.order_item.create({
                data: {
                  order_id: id,
                  product_id: itemDto.product_id,
                  quantity: itemDto.quantity,
                  unit_price: itemPrice.toString(),
                  subtotal: subtotal.toString(),
                },
              });
            }

            if (quantityChange !== 0 && !productDetails.is_returnable) {
              const movementTypeForUpdate =
                quantityChange > 0
                  ? saleMovementTypeId
                  : await this.inventoryService.getMovementTypeIdByCode(
                      BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_CLIENTE,
                      tx,
                    );
              await this.inventoryService.createStockMovement(
                {
                  movement_type_id: movementTypeForUpdate,
                  product_id: itemDto.product_id,
                  quantity: Math.abs(quantityChange),
                  source_warehouse_id:
                    quantityChange < 0
                      ? null
                      : BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                  destination_warehouse_id:
                    quantityChange < 0
                      ? BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID
                      : null,
                  movement_date: new Date(),
                  remarks: `${this.entityName} #${id} - Ajuste producto ${itemDto.product_id} (${productDetails.description}), cantidad: ${quantityChange}`,
                },
                tx,
              );
            }
          }
        }

        if (Object.keys(dataToUpdate).length > 0) {
          await tx.order_header.update({
            where: { order_id: id },
            data: dataToUpdate,
          });
        }

        if (item_ids_to_delete && item_ids_to_delete.length > 0) {
          const itemsBeingDeleted = existingOrder.order_item.filter((item) =>
            item_ids_to_delete.includes(item.order_item_id),
          );
          const returnMovementTypeId =
            await this.inventoryService.getMovementTypeIdByCode(
              BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_CLIENTE,
              tx,
            );

          for (const itemToDelete of itemsBeingDeleted) {
            if (
              !itemToDelete.product.is_returnable &&
              itemToDelete.quantity > 0
            ) {
              await this.inventoryService.createStockMovement(
                {
                  movement_type_id: returnMovementTypeId,
                  product_id: itemToDelete.product_id,
                  quantity: itemToDelete.quantity,
                  source_warehouse_id: null,
                  destination_warehouse_id:
                    BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                  movement_date: new Date(),
                  remarks: `${this.entityName} #${id} - Devolución por eliminación de ítem ${itemToDelete.product_id} (${itemToDelete.product.description})`,
                },
                tx,
              );
            }
          }
          await tx.order_item.deleteMany({
            where: { order_item_id: { in: item_ids_to_delete }, order_id: id },
          });
        }

        const updatedOrderItems = await tx.order_item.findMany({
          where: { order_id: id },
        });
        const newOrderTotalAmount = updatedOrderItems.reduce(
          (sum, item) => sum.plus(new Decimal(item.subtotal)),
          new Decimal(0),
        );
        const currentPaidAmount = new Decimal(existingOrder.paid_amount);
        await tx.order_header.update({
          where: { order_id: id },
          data: {
            total_amount: newOrderTotalAmount.toString(),
            paid_amount: newOrderTotalAmount.lessThan(currentPaidAmount)
              ? newOrderTotalAmount.toString()
              : currentPaidAmount.toString(),
          },
        });

        const finalOrder = await tx.order_header.findUniqueOrThrow({
          where: { order_id: id },
          include: {
            order_item: { include: { product: true } },
            customer: { include: { locality: true, zone: true } },
            sale_channel: true,
            customer_subscription: { include: { subscription_plan: true } },
            client_contract: true,
            zone: true,
            payment_transaction: {
              include: {
                payment_method: true,
              },
            },
          },
        });
        return this.mapToOrderResponseDto(finalOrder);
      });
      return order;
    } catch (error) {
      handlePrismaError(error, this.entityName);
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          'Error no manejado después de handlePrismaError en update order.',
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<{ message: string; deleted: boolean }> {
    await this.findOne(id);
    try {
      await this.$transaction(async (tx) => {
        // Obtener información completa del pedido antes de eliminarlo
        const orderToDelete = await tx.order_header.findUnique({
          where: { order_id: id },
          include: {
            order_item: { include: { product: true } },
            customer_subscription: { include: { subscription_plan: true } },
          },
        });

        if (!orderToDelete) {
          throw new NotFoundException(
            `${this.entityName} con ID ${id} no encontrado.`,
          );
        }

        const orderItems = orderToDelete.order_item;
        const returnMovementTypeId =
          await this.inventoryService.getMovementTypeIdByCode(
            BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_PEDIDO_CANCELADO,
            tx,
          );

        // 🆕 NUEVO: Reiniciar créditos de suscripción si el pedido no está en estado IN_DELIVERY o DELIVERED
        console.log(`🆕 ELIMINANDO PEDIDO ${id}:`);
        console.log(`  - Estado del pedido: ${orderToDelete.status}`);
        console.log(
          `  - Tiene suscripción: ${orderToDelete.customer_subscription ? 'SÍ' : 'NO'}`,
        );

        if (
          orderToDelete.customer_subscription &&
          orderToDelete.status !== 'IN_DELIVERY' &&
          orderToDelete.status !== 'DELIVERED'
        ) {
          console.log(`  - ✅ Aplicando reinicio de créditos...`);

          // Obtener información del plan de suscripción para determinar qué productos afectan los créditos
          const subscription = await tx.customer_subscription.findUnique({
            where: {
              subscription_id:
                orderToDelete.customer_subscription.subscription_id,
            },
            include: {
              subscription_plan: {
                include: {
                  subscription_plan_product: true,
                },
              },
            },
          });

          if (subscription) {
            const planProductIds =
              subscription.subscription_plan.subscription_plan_product.map(
                (spp) => spp.product_id,
              );

            console.log(
              `  - Productos en plan de suscripción:`,
              planProductIds,
            );

            // Solo reiniciar créditos para productos que están en el plan de suscripción
            console.log(
              `  - DEBUG: Todos los productos del pedido:`,
              orderItems.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
              })),
            );
            console.log(
              `  - DEBUG: Productos en plan de suscripción:`,
              planProductIds,
            );

            const subscriptionItems = orderItems.filter((item) =>
              planProductIds.includes(item.product_id),
            );

            console.log(
              `  - Productos del pedido que están en plan:`,
              subscriptionItems.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
              })),
            );

            if (subscriptionItems.length > 0) {
              const itemsForCreditReset = subscriptionItems.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
              }));

              console.log(
                `  - Reiniciando créditos para:`,
                itemsForCreditReset,
              );

              await this.subscriptionQuotaService.resetCreditsForDeletedOrder(
                orderToDelete.customer_subscription.subscription_id,
                itemsForCreditReset,
                tx,
              );

              console.log(`  - ✅ Créditos reiniciados exitosamente`);
            } else {
              console.log(`  - ⚠️ No hay productos del plan en este pedido`);
            }
          } else {
            console.log(`  - ❌ No se encontró información de suscripción`);
          }
        } else {
          console.log(`  - ❌ No se reinician créditos porque:`);
          console.log(`    - Estado: ${orderToDelete.status}`);
          console.log(
            `    - Tiene suscripción: ${orderToDelete.customer_subscription ? 'SÍ' : 'NO'}`,
          );
        }

        for (const item of orderItems) {
          if (item.quantity > 0) {
            console.log(
              `🔄 CANCELACIÓN - Producto ${item.product_id} (${item.product.description}):`,
            );
            console.log(
              `  - Es retornable: ${item.product.is_returnable ? 'SÍ' : 'NO'}`,
            );
            console.log(`  - Cantidad: ${item.quantity}`);
            console.log(`  - Tipo de orden: ${orderToDelete.order_type}`);
            console.log(`  - Monto pagado: $${orderToDelete.paid_amount}`);

            // 🔧 CORRECCIÓN: Determinar la cantidad correcta a devolver al stock
            const quantityToReturn = item.quantity;

            // Solo para órdenes SUBSCRIPTION puras, verificar si había cantidad cubierta por suscripción
            if (
              orderToDelete.customer_subscription &&
              orderToDelete.order_type === 'SUBSCRIPTION'
            ) {
              // Para órdenes de suscripción pura, la cantidad que se restó del stock fue solo la adicional
              // Necesitamos calcular cuánto se restó realmente del stock cuando se creó la orden
              console.log(
                `  - ⚠️ Orden de suscripción: verificando cantidad que se restó del stock`,
              );
              // En este caso, mantener la cantidad completa para devolución
              // porque el sistema de suscripción ya manejó los créditos
            }

            console.log(
              `  - Cantidad a devolver al stock: ${quantityToReturn}`,
            );

            // 🔧 CORRECCIÓN: Crear movimiento de devolución SOLO para productos NO retornables
            // Los productos retornables nunca tuvieron stock descontado, por lo que no necesitan devolución
            if (!item.product.is_returnable) {
              await this.inventoryService.createStockMovement(
                {
                  movement_type_id: returnMovementTypeId,
                  product_id: item.product_id,
                  quantity: quantityToReturn,
                  source_warehouse_id: null,
                  destination_warehouse_id:
                    BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                  movement_date: new Date(),
                  remarks: `${this.entityName} #${id} CANCELADO - Devolución producto no retornable ${item.product.description} (ID ${item.product_id}) - Abono original: $${orderToDelete.paid_amount}`,
                },
                tx,
              );

              console.log(
                `✅ Stock devuelto: ${quantityToReturn} unidades de ${item.product.description} (NO retornable) - Abono original: $${orderToDelete.paid_amount}`,
              );
            } else {
              console.log(
                `⏭️ No se devuelve stock para ${item.product.description} - producto RETORNABLE (nunca se descontó stock)`,
              );
            }
          }
        }

        // Soft delete: cambiar is_active a false en lugar de eliminar físicamente
        await tx.order_header.update({
          where: { order_id: id },
          data: { is_active: false }
        });
      });
      return {
        message: `${this.entityName} con ID ${id} ha sido desactivado correctamente. El stock de productos no retornables ha sido restaurado. Los créditos de suscripción han sido reiniciados si corresponde.`,
        deleted: true,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        handlePrismaError(
          error,
          `El ${this.entityName.toLowerCase()} con ID ${id} no se puede eliminar porque tiene datos relacionados (ej. en hojas de ruta activas).`,
        );
      } else {
        handlePrismaError(error, this.entityName);
      }

      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          'Error no manejado después de handlePrismaError en remove order.',
        );
      }
      throw error;
    }
  }

  /**
   * Procesa un pago para una orden híbrida
   */
  async processPayment(
    orderId: number,
    processPaymentDto: ProcessPaymentDto,
    userId: number,
  ): Promise<Prisma.payment_transactionGetPayload<{}>> {
    return this.processOrderPayment(orderId, processPaymentDto, userId, 'HYBRID');
  }

  /**
   * Procesa un pago para una orden ONE_OFF
   */
  async processOneOffPayment(
    orderId: number,
    processPaymentDto: ProcessPaymentDto,
    userId: number,
  ): Promise<Prisma.payment_transactionGetPayload<{}>> {
    try {
      // 🆕 BÚSQUEDA PARALELA: Buscar en ambas estructuras como en findOneOneOff
      const [legacyPurchase, headerPurchase] = await Promise.all([
        // Buscar en estructura legacy
        this.one_off_purchase
          .findUnique({
            where: { purchase_id: orderId },
            include: {
              person: true,
            },
          })
          .catch(() => null),
        // Buscar en estructura nueva
        this.one_off_purchase_header
          .findUnique({
            where: { purchase_header_id: orderId },
            include: {
              person: true,
            },
          })
          .catch(() => null),
      ]);

      const order = headerPurchase || legacyPurchase;

      if (!order) {
        throw new NotFoundException(`Orden ONE-OFF con ID ${orderId} no encontrada.`);
      }

      // Determinar si es estructura legacy o nueva
      const isLegacyStructure = !!legacyPurchase && !headerPurchase;
      const orderIdField = isLegacyStructure ? 'purchase_id' : 'purchase_header_id';

      // Validar método de pago
      const paymentMethod = await this.payment_method.findUnique({
        where: { payment_method_id: processPaymentDto.payment_method_id },
      });

      if (!paymentMethod) {
        throw new BadRequestException(
          `Método de pago con ID ${processPaymentDto.payment_method_id} no es válido.`,
        );
      }

      const paymentAmount = new Decimal(processPaymentDto.amount);
      if (paymentAmount.isNegative() || paymentAmount.isZero()) {
        throw new BadRequestException('El monto del pago debe ser positivo.');
      }

      const paymentTransactionResult = await this.$transaction(async (tx) => {
        const orderCurrentPaidAmount = new Decimal(order.paid_amount);
        const orderTotalAmount = new Decimal(order.total_amount);
        const remainingBalance = orderTotalAmount.minus(orderCurrentPaidAmount);

        if (paymentAmount.greaterThan(remainingBalance.plus(0.001))) {
          const orderIdValue = isLegacyStructure ? order.purchase_id : order.purchase_header_id;
          throw new BadRequestException(
            `El monto del pago (${paymentAmount}) excede el saldo pendiente (${remainingBalance.toFixed(2)}) de la orden ONE-OFF ${orderIdValue}.`,
          );
        }

        const orderIdValue = isLegacyStructure ? order.purchase_id : order.purchase_header_id;
        
        const paymentTransaction = await tx.payment_transaction.create({
          data: {
            transaction_date: processPaymentDto.payment_date
              ? new Date(processPaymentDto.payment_date)
              : new Date(),
            customer_id: order.person_id,
            order_id: null, // ONE-OFF orders don't use order_id
            document_number: `ONE-OFF-${orderIdValue}`,
            receipt_number: processPaymentDto.transaction_reference,
            transaction_type: 'PAYMENT',
            previous_balance: orderTotalAmount
              .minus(orderCurrentPaidAmount)
              .toString(),
            transaction_amount: paymentAmount.toString(),
            total: paymentAmount.toString(),
            payment_method_id: processPaymentDto.payment_method_id,
            user_id: userId,
            notes: processPaymentDto.notes,
          },
        });

        const newPaidAmount = orderCurrentPaidAmount.plus(paymentAmount);
        
        // Actualizar payment_status si está completamente pagado
        const newPaymentStatus = newPaidAmount.greaterThanOrEqualTo(orderTotalAmount) 
          ? 'PAID' 
          : 'PARTIAL';

        // Actualizar en la tabla correspondiente según la estructura
        if (isLegacyStructure) {
          // La estructura legacy no tiene payment_status, solo actualizar paid_amount
          await tx.one_off_purchase.update({
            where: { purchase_id: order.purchase_id },
            data: {
              paid_amount: newPaidAmount.toString(),
            },
          });
        } else {
          // La estructura nueva sí tiene payment_status
          await tx.one_off_purchase_header.update({
            where: { purchase_header_id: order.purchase_header_id },
            data: {
              paid_amount: newPaidAmount.toString(),
              payment_status: newPaymentStatus,
            },
          });
        }

        return paymentTransaction;
      });

      return paymentTransactionResult;
    } catch (error) {
      handlePrismaError(error, 'Pedido ONE-OFF');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          'Error inesperado al procesar el Pedido: ' + error.message,
        );
      }
      throw error;
    }
  }

  /**
   * Método genérico para procesar pagos de órdenes
   */
  private async processOrderPayment(
    orderId: number,
    processPaymentDto: ProcessPaymentDto,
    userId: number,
    expectedOrderType: string,
  ): Promise<Prisma.payment_transactionGetPayload<{}>> {
    try {
      const order = await this.order_header.findUnique({
        where: { order_id: orderId },
        include: {
          customer: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Orden con ID ${orderId} no encontrada.`);
      }

      // Validar que la orden sea del tipo esperado
      if (order.order_type !== expectedOrderType) {
        throw new BadRequestException(
          `Esta orden es de tipo ${order.order_type}, pero se esperaba ${expectedOrderType}.`,
        );
      }

      // Validar método de pago
      const paymentMethod = await this.payment_method.findUnique({
        where: { payment_method_id: processPaymentDto.payment_method_id },
      });

      if (!paymentMethod) {
        throw new BadRequestException(
          `Método de pago con ID ${processPaymentDto.payment_method_id} no es válido.`,
        );
      }

      const paymentAmount = new Decimal(processPaymentDto.amount);
      if (paymentAmount.isNegative() || paymentAmount.isZero()) {
        throw new BadRequestException('El monto del pago debe ser positivo.');
      }

      const paymentTransactionResult = await this.$transaction(async (tx) => {
        const orderCurrentPaidAmount = new Decimal(order.paid_amount);
        const orderTotalAmount = new Decimal(order.total_amount);
        const remainingBalance = orderTotalAmount.minus(orderCurrentPaidAmount);

        if (paymentAmount.greaterThan(remainingBalance.plus(0.001))) {
          throw new BadRequestException(
            `El monto del pago (${paymentAmount}) excede el saldo pendiente (${remainingBalance.toFixed(2)}) de la orden ${order.order_id}.`,
          );
        }

        const paymentTransaction = await tx.payment_transaction.create({
          data: {
            transaction_date: processPaymentDto.payment_date
              ? new Date(processPaymentDto.payment_date)
              : new Date(),
            customer_id: order.customer_id,
            order_id: order.order_id,
            document_number: `ORD-${order.order_id}`,
            receipt_number: processPaymentDto.transaction_reference,
            transaction_type: 'PAYMENT',
            previous_balance: orderTotalAmount
              .minus(orderCurrentPaidAmount)
              .toString(),
            transaction_amount: paymentAmount.toString(),
            total: paymentAmount.toString(),
            payment_method_id: processPaymentDto.payment_method_id,
            user_id: userId,
            notes: processPaymentDto.notes,
          },
        });

        const newPaidAmount = orderCurrentPaidAmount.plus(paymentAmount);
        const newOrderStatus = order.status;
        
        // Determinar payment_status basado en el monto pagado
        const newPaymentStatus = newPaidAmount.greaterThanOrEqualTo(orderTotalAmount) 
          ? 'PAID' 
          : newPaidAmount.equals(0) 
            ? 'PENDING' 
            : 'PARTIAL';
        
        // Note: Order status remains unchanged when fully paid
        // Payment completion doesn't automatically change delivery status

        await tx.order_header.update({
          where: { order_id: order.order_id },
          data: {
            paid_amount: newPaidAmount.toString(),
            status: newOrderStatus,
            payment_status: newPaymentStatus,
          },
        });

        return paymentTransaction;
      });

      return paymentTransactionResult;
    } catch (error) {
      handlePrismaError(error, this.entityName);
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          'Error no manejado al procesar el pago.',
        );
      }
      throw error;
    }
  }

  /**
   * Genera una orden de cobranza automáticamente para un ciclo específico
   */
  async generateCollectionOrder(
    cycleId: number,
    collectionDateStr: string,
    notes?: string,
    userId?: number,
  ): Promise<{
    success: boolean;
    message: string;
    order_id: number;
    cycle_id: number;
    collection_amount: string;
    collection_date: string;
  }> {
    try {
      // Validar y parsear la fecha
      const collectionDate = new Date(collectionDateStr);
      if (isNaN(collectionDate.getTime())) {
        throw new BadRequestException('Fecha de cobranza inválida. Use formato YYYY-MM-DD');
      }

      // Obtener información del ciclo
      const cycle = await this.subscription_cycle.findUnique({
        where: { cycle_id: cycleId },
        include: {
          customer_subscription: {
            include: {
              person: true,
              subscription_plan: true,
            },
          },
        },
      });

      if (!cycle) {
        throw new NotFoundException(`Ciclo de suscripción con ID ${cycleId} no encontrado`);
      }

      const person = cycle.customer_subscription.person;
      const subscription = cycle.customer_subscription;

      // Verificar si ya existe una orden de cobranza para este ciclo
      const existingCollectionOrder = await this.order_header.findFirst({
        where: {
          customer_id: person.person_id,
          notes: {
            contains: `Ciclo: ${cycleId}`,
          },
          order_type: 'ONE_OFF',
          status: {
            in: ['PENDING', 'CONFIRMED', 'IN_PREPARATION', 'READY_FOR_DELIVERY', 'IN_DELIVERY'],
          },
        },
      });

      if (existingCollectionOrder) {
        throw new BadRequestException(
          `Ya existe una orden de cobranza activa para el ciclo ${cycleId} (Orden ID: ${existingCollectionOrder.order_id})`
        );
      }

      // Verificar que el ciclo tenga saldo pendiente
      const pendingBalance = new Decimal(cycle.pending_balance || 0);
      if (pendingBalance.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          `El ciclo ${cycleId} no tiene saldo pendiente por cobrar. Saldo actual: $${pendingBalance.toString()}`
        );
      }

      // Crear la orden de cobranza
      const createOrderDto: CreateOrderDto = {
        customer_id: person.person_id,
        subscription_id: subscription.subscription_id,
        sale_channel_id: 1, // Canal por defecto para cobranzas automáticas
        order_date: new Date().toISOString(),
        scheduled_delivery_date: collectionDate.toISOString(),
        delivery_time: '09:00-18:00',
        total_amount: '0.00', // Pedido de cobranza sin productos adicionales
        paid_amount: '0.00',
        order_type: 'ONE_OFF' as any,
        status: 'PENDING' as any,
        notes: [
          'ORDEN DE COBRANZA AUTOMÁTICA GENERADA',
          `Suscripción: ${subscription.subscription_plan.name}`,
          `Ciclo: ${cycleId}`,
          `Monto a cobrar: $${pendingBalance.toString()}`,
          cycle.payment_due_date ? `Vencimiento: ${cycle.payment_due_date.toISOString().split('T')[0]}` : '',
          notes ? `Notas adicionales: ${notes}` : '',
        ].filter(Boolean).join(' - '),
        items: [], // Sin productos, solo cobranza
      };

      const newOrder = await this.create(createOrderDto);

      this.logger.log(
        `✅ Orden de cobranza generada: ID ${newOrder.order_id} para ciclo ${cycleId}, cliente ${person.name}, monto $${pendingBalance.toString()}`
      );

      return {
        success: true,
        message: 'Orden de cobranza generada exitosamente',
        order_id: newOrder.order_id,
        cycle_id: cycleId,
        collection_amount: pendingBalance.toString(),
        collection_date: collectionDateStr,
      };
    } catch (error) {
      this.logger.error(`Error generando orden de cobranza para ciclo ${cycleId}:`, error);
      
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      
      throw new InternalServerErrorException(
        `Error inesperado al generar orden de cobranza: ${error.message}`
      );
    }
  }
}
