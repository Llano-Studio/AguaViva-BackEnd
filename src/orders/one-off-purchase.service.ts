import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PersonType, OrderType } from '../common/constants/enums';
import { CreateOneOffPurchaseDto } from './dto/create-one-off-purchase.dto';
import { UpdateOneOffPurchaseDto } from './dto/update-one-off-purchase.dto';
import { FilterOneOffPurchasesDto } from './dto/filter-one-off-purchases.dto';
import { OneOffPurchaseResponseDto } from './dto/one-off-purchase-response.dto';
import { InventoryService } from '../inventory/inventory.service';
import { CreateStockMovementDto } from '../inventory/dto/create-stock-movement.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import {
  parseSortByString,
  mapOneOffSortFields,
  mapOneOffHeaderSortFields,
} from '../common/utils/query-parser.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@Injectable()
export class OneOffPurchaseService
  extends PrismaClient
  implements OnModuleInit
{
  constructor(private readonly inventoryService: InventoryService) {
    super();
  }

  private readonly logger = new Logger(OneOffPurchaseService.name);

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Carga las transacciones de pago relacionadas con una orden one-off
   */
  private async loadPaymentTransactions(
    customerId: number,
    orderIdValue: number,
    isLegacyStructure: boolean,
  ): Promise<any[]> {
    const documentNumberPattern = `ONE-OFF-${orderIdValue}`;

    this.logger.log(
      `🔍 Buscando pagos para: customer_id=${customerId}, document_number=${documentNumberPattern}`,
    );

    const payments = await this.payment_transaction.findMany({
      where: {
        customer_id: customerId,
        document_number: documentNumberPattern,
        is_active: true,
      },
      include: {
        payment_method: true,
      },
      orderBy: {
        transaction_date: 'desc',
      },
    });

    this.logger.log(
      `✅ Encontrados ${payments.length} pagos para la orden ONE-OFF ${orderIdValue}`,
    );

    return payments;
  }

  async findAllSimpleOneOff(): Promise<any> {
    try {
      const purchases = await this.one_off_purchase.findMany({
        include: {
          product: true,
          person: true,
          sale_channel: true,
          locality: true,
          zone: true,
          price_list: true,
        },
        orderBy: { purchase_date: 'desc' },
      });

      return purchases.map((purchase) => ({
        purchase_id: purchase.purchase_id,
        person_id: purchase.person_id,
        purchase_date: purchase.purchase_date.toISOString(),
        total_amount: purchase.total_amount.toString(),
        paid_amount: purchase.paid_amount.toString(),
        notes: purchase.notes,
        delivery_address: purchase.delivery_address,
        person: {
          person_id: purchase.person.person_id,
          name: purchase.person.name || 'Nombre no disponible',
          phone: purchase.person.phone || '',
          address: purchase.person.address || undefined,
        },
        products: [
          {
            product_id: purchase.product_id,
            description: purchase.product.description,
            quantity: purchase.quantity,
            unit_price: purchase.total_amount.div(purchase.quantity).toString(),
            subtotal: purchase.total_amount.toString(),
            price_list_id: purchase.price_list?.price_list_id || null,
          },
        ],
        sale_channel: {
          sale_channel_id: purchase.sale_channel.sale_channel_id,
          name: purchase.sale_channel.description || 'Canal no disponible',
        },
        locality: purchase.locality
          ? {
              locality_id: purchase.locality.locality_id,
              name: purchase.locality.name,
            }
          : null,
        zone: purchase.zone
          ? {
              zone_id: purchase.zone.zone_id,
              name: purchase.zone.name,
            }
          : null,
      }));
    } catch (error) {
      handlePrismaError(error, 'Compra de Única Vez');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al buscar compras de única vez`,
        );
      }
      throw error;
    }
  }

  async createOneOff(
    createDto: CreateOneOffPurchaseDto,
  ): Promise<OneOffPurchaseResponseDto> {
    try {
      return await this.$transaction(async (prismaTx) => {
        // Validar que hay items
        if (!createDto.items || createDto.items.length === 0) {
          throw new BadRequestException(
            'Debe especificar al menos un producto en la compra.',
          );
        }

        // Tomar el primer item (limitación actual del sistema)
        const firstItem = createDto.items[0];
        const product = await prismaTx.product.findUniqueOrThrow({
          where: { product_id: firstItem.product_id },
        });

        // Determinar qué lista de precios usar
        const priceListId =
          firstItem.price_list_id ||
          BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;

        // Buscar precio en la lista específica
        let itemPrice = new Decimal(product.price); // Precio base como fallback

        const priceItem = await prismaTx.price_list_item.findFirst({
          where: {
            price_list_id: priceListId,
            product_id: firstItem.product_id,
          },
        });

        if (priceItem) {
          itemPrice = new Decimal(priceItem.unit_price);
        }

        const totalAmount = itemPrice.mul(firstItem.quantity);

        // Verificar stock para productos no retornables
        if (!product.is_returnable) {
          const stockDisponible = await this.inventoryService.getProductStock(
            firstItem.product_id,
            BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
            prismaTx,
          );
          if (stockDisponible < firstItem.quantity) {
            throw new BadRequestException(
              `Compra One-Off: Stock insuficiente para ${product.description}. Disponible: ${stockDisponible}, Solicitado: ${firstItem.quantity}.`,
            );
          }
        }

        // Determinar status basado en requires_delivery o usar el status proporcionado
        const orderStatus =
          createDto.status ||
          (createDto.requires_delivery === false ? 'DELIVERED' : 'PENDING');

        const newPurchase = await prismaTx.one_off_purchase.create({
          data: {
            person_id: 0, // Este método ya no se usa, pero mantenemos la estructura
            product_id: firstItem.product_id,
            quantity: firstItem.quantity,
            sale_channel_id: createDto.sale_channel_id,
            price_list_id: priceListId,
            delivery_address: createDto.delivery_address,
            locality_id:
              createDto.locality_id && createDto.locality_id > 0
                ? createDto.locality_id
                : null,
            zone_id:
              createDto.zone_id && createDto.zone_id > 0
                ? createDto.zone_id
                : null,
            paid_amount: new Decimal(0),
            notes: createDto.notes,
            purchase_date: createDto.purchase_date
              ? new Date(createDto.purchase_date)
              : new Date(),
            scheduled_delivery_date:
              createDto.scheduled_delivery_date &&
              createDto.scheduled_delivery_date.trim() !== ''
                ? new Date(createDto.scheduled_delivery_date)
                : null,
            delivery_time:
              createDto.delivery_time && createDto.delivery_time.trim() !== ''
                ? createDto.delivery_time
                : null,
            total_amount: totalAmount,
            status: orderStatus,
            requires_delivery: createDto.requires_delivery === true, // Asegurar que sea boolean
          },
          include: {
            product: true,
            person: true,
            sale_channel: true,
            locality: true,
            zone: true,
            price_list: true,
          },
        });

        // Crear movimiento de stock para productos no retornables
        if (!product.is_returnable) {
          const saleMovementTypeId =
            await this.inventoryService.getMovementTypeIdByCode(
              BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA,
              prismaTx,
            );

          const stockMovement: CreateStockMovementDto = {
            movement_type_id: saleMovementTypeId,
            product_id: firstItem.product_id,
            quantity: firstItem.quantity,
            source_warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
            movement_date: new Date(),
            remarks: `Compra One-Off #${newPurchase.purchase_id} - ${product.description}`,
          };
          await this.inventoryService.createStockMovement(
            stockMovement,
            prismaTx,
          );
        }

        return await this.mapToOneOffPurchaseResponseDto(newPurchase);
      });
    } catch (error) {
      handlePrismaError(error, 'Compra One-Off');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al crear compra one-off`,
        );
      }
      throw error;
    }
  }

  async createOneOffWithCustomerLogic(
    createDto: any,
  ): Promise<OneOffPurchaseResponseDto> {
    try {
      return await this.$transaction(async (prismaTx) => {
        // Validar que hay items
        if (!createDto.items || createDto.items.length === 0) {
          throw new BadRequestException(
            'Debe especificar al menos un producto en la compra.',
          );
        }

        // Buscar o crear el cliente

        let person = await prismaTx.person.findFirst({
          where: { phone: createDto.customer.phone },
        });

        if (!person) {

          // Validar que se proporcionen los campos obligatorios para cliente nuevo
          if (!createDto.customer.name) {
            throw new BadRequestException(
              'Para clientes nuevos, debe proporcionar: name',
            );
          }

          // Solo requerir localityId y zoneId si requiere entrega a domicilio
          if (
            createDto.requires_delivery === true &&
            (!createDto.customer.localityId || !createDto.customer.zoneId)
          ) {
            throw new BadRequestException(
              'Para clientes nuevos con entrega a domicilio, debe proporcionar: localityId y zoneId',
            );
          }

          // Crear nuevo cliente
          person = await prismaTx.person.create({
            data: {
              name: createDto.customer.name,
              phone: createDto.customer.phone,
              additional_phones: createDto.customer.additionalPhones,
              alias: createDto.customer.alias,
              address: createDto.customer.address,
              tax_id: createDto.customer.taxId,
              ...(createDto.customer.localityId && {
                locality: {
                  connect: { locality_id: createDto.customer.localityId },
                },
              }),
              ...(createDto.customer.zoneId && {
                zone: { connect: { zone_id: createDto.customer.zoneId } },
              }),
              type: (createDto.customer.type || 'INDIVIDUAL') as PersonType,
            },
          });
        } else {
        }

        // Calcular total_amount y preparar items
        let totalAmount = new Decimal(0);
        const purchaseItems: any[] = [];

        for (const item of createDto.items) {
          const product = await prismaTx.product.findUnique({
            where: { product_id: item.product_id },
          });
          if (!product) {
            throw new BadRequestException(
              `Producto con ID ${item.product_id} no encontrado. Verifique que el producto existe antes de crear la compra.`,
            );
          }

          const itemPriceListId =
            item.price_list_id || BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
          let itemPrice = new Decimal(product.price);

          const priceItem = await prismaTx.price_list_item.findFirst({
            where: {
              price_list_id: itemPriceListId,
              product_id: item.product_id,
            },
          });

          if (priceItem) {
            itemPrice = new Decimal(priceItem.unit_price);
          }

          const itemSubtotal = itemPrice.mul(item.quantity);
          totalAmount = totalAmount.add(itemSubtotal);

          // 🆕 CORRECCIÓN: Verificar stock SOLO para productos NO retornables
          if (!product.is_returnable) {
            const stockDisponible = await this.inventoryService.getProductStock(
              item.product_id,
              BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
              prismaTx,
            );
            if (stockDisponible < item.quantity) {
              throw new BadRequestException(
                `Compra One-Off: Stock insuficiente para ${product.description}. Disponible: ${stockDisponible}, Solicitado: ${item.quantity}.`,
              );
            }
          } else {
          }

          // Verificar que existe la price_list
          const priceListExists = await prismaTx.price_list.findUnique({
            where: { price_list_id: itemPriceListId },
          });

          if (!priceListExists) {
            throw new BadRequestException(
              `Lista de precios con ID ${itemPriceListId} no encontrada. Verifique que la lista de precios existe antes de crear la compra.`,
            );
          }

          purchaseItems.push({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: itemPrice.toString(),
            subtotal: itemSubtotal.toString(),
            price_list_id: itemPriceListId,
            notes: item.notes || null,
          });
        }

        // Determinar total_amount y paid_amount correctamente
        let finalTotalAmount = totalAmount; // Usar el total calculado por el servidor

        // Si el usuario envía total_amount, validar que coincida con el cálculo del servidor
        if (createDto.total_amount) {
          const userTotalAmount = new Decimal(createDto.total_amount);
          if (!userTotalAmount.equals(totalAmount)) {
            throw new BadRequestException(
              `El total_amount proporcionado (${userTotalAmount.toString()}) no coincide con el total calculado por el servidor (${totalAmount.toString()}). Verifique los precios y cantidades.`,
            );
          }
          finalTotalAmount = userTotalAmount;
        }

        // CORRECCIÓN: Las órdenes oneOff siempre se crean con paid_amount = 0
        // Los pagos deben registrarse por separado a través del sistema de transacciones de pago
        const finalPaidAmount = new Decimal(0);

        // Validación completada exitosamente
        
        // NOTA: Se removió la validación de paid_amount vs total_amount ya que 
        // las órdenes oneOff siempre se crean sin pagos registrados

        // Determinar dirección, localidad y zona según requires_delivery
        let deliveryAddress = null;
        let deliveryLocalityId = null;
        let deliveryZoneId = null;

        if (createDto.requires_delivery === true) {
          deliveryAddress = createDto.delivery_address || person.address;
          deliveryLocalityId =
            createDto.locality_id && createDto.locality_id > 0
              ? createDto.locality_id
              : createDto.customer.localityId &&
                  createDto.customer.localityId > 0
                ? createDto.customer.localityId
                : person.locality_id && person.locality_id > 0
                  ? person.locality_id
                  : null;
          deliveryZoneId =
            createDto.zone_id && createDto.zone_id > 0
              ? createDto.zone_id
              : createDto.customer.zoneId && createDto.customer.zoneId > 0
                ? createDto.customer.zoneId
                : person.zone_id && person.zone_id > 0
                  ? person.zone_id
                  : null;
        }

        // Determinar status basado en requires_delivery o usar el status proporcionado
        const orderStatus =
          createDto.status ||
          (createDto.requires_delivery === false ? 'DELIVERED' : 'PENDING');

        // 🆕 CREAR UNA SOLA ORDEN HEADER CON MÚLTIPLES ITEMS

        const newPurchaseHeader = await prismaTx.one_off_purchase_header.create(
          {
            data: {
              person_id: person.person_id,
              sale_channel_id: createDto.sale_channel_id,
              purchase_date: createDto.purchase_date
                ? new Date(createDto.purchase_date)
                : new Date(),
              total_amount: finalTotalAmount.toString(),
              paid_amount: finalPaidAmount.toString(),
              delivery_address: deliveryAddress,
              locality_id: deliveryLocalityId,
              zone_id: deliveryZoneId,
              notes: createDto.notes,
              status: orderStatus,
              scheduled_delivery_date:
                createDto.scheduled_delivery_date &&
                createDto.scheduled_delivery_date.trim() !== ''
                  ? new Date(createDto.scheduled_delivery_date)
                  : null,
              delivery_time:
                createDto.delivery_time && createDto.delivery_time.trim() !== ''
                  ? createDto.delivery_time
                  : null,
              purchase_items: {
                createMany: {
                  data: purchaseItems,
                },
              },
            },
            include: {
              person: true,
              sale_channel: true,
              locality: true,
              zone: true,
              purchase_items: {
                include: {
                  product: true,
                  price_list: true,
                },
              },
            },
          },
        );

        // Compra creada exitosamente

        // 🆕 CORRECCIÓN: Crear movimientos de stock SOLO para productos NO retornables
        for (const item of createDto.items) {
          // Obtener información del producto para verificar si es retornable
          const product = await prismaTx.product.findUnique({
            where: { product_id: item.product_id },
            select: { is_returnable: true, description: true },
          });

          // Solo crear movimiento de stock para productos NO retornables
          if (product && !product.is_returnable) {
            const saleMovementTypeId =
              await this.inventoryService.getMovementTypeIdByCode(
                BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA,
                prismaTx,
              );

            const stockMovement: CreateStockMovementDto = {
              movement_type_id: saleMovementTypeId,
              product_id: item.product_id,
              quantity: item.quantity,
              source_warehouse_id:
                BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
              movement_date: new Date(),
              remarks: `Compra One-Off Header #${newPurchaseHeader.purchase_header_id} - ${product.description} (NO retornable)`,
            };
            await this.inventoryService.createStockMovement(
              stockMovement,
              prismaTx,
            );

          } else if (product && product.is_returnable) {

          }
        }

        // Retornar respuesta usando el nuevo header/items structure
        return await this.mapToHeaderItemsOneOffPurchaseResponseDto(
          newPurchaseHeader,
        );
      });
    } catch (error) {
      console.error('🚨 ERROR EN createOneOffWithCustomerLogic:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
      });
      handlePrismaError(error, 'Compra One-Off con Cliente');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al crear compra one-off con cliente`,
        );
      }
      throw error;
    }
  }

  async findAllOneOff(filters: FilterOneOffPurchasesDto): Promise<any> {
    try {
      // 🆕 NUEVA LÓGICA: Combinar resultados de ambas estructuras
      const [legacyResults, headerResults] = await Promise.all([
        this.findAllLegacyOneOff(filters),
        this.findAllHeaderOneOff(filters),
      ]);

      // Combinar y ordenar resultados por fecha
      const allOrders = [...legacyResults.data, ...headerResults.data];
      allOrders.sort(
        (a, b) =>
          new Date(b.purchase_date).getTime() -
          new Date(a.purchase_date).getTime(),
      );

      // Aplicar paginación al resultado combinado
      const { page = 1, limit = 10 } = filters;
      const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
      const take = Math.max(1, limit);
      const paginatedData = allOrders.slice(skip, skip + take);

      return {
        data: paginatedData,
        meta: {
          total: allOrders.length,
          page: Math.max(1, page),
          limit: take,
          totalPages: Math.ceil(allOrders.length / take),
        },
      };
    } catch (error) {
      handlePrismaError(error, 'Compras One-Off');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al buscar compras one-off`,
        );
      }
      throw error;
    }
  }

  async findAllLegacyOneOff(filters: FilterOneOffPurchasesDto): Promise<any> {
    const {
      search,
      customerName,
      productName,
      page = 1,
      limit = 10,
      sortBy,
      purchaseDateFrom,
      purchaseDateTo,
      deliveryDateFrom,
      deliveryDateTo,
      person_id,
      product_id,
      sale_channel_id,
      locality_id,
      zone_id,
      status,
      statuses,
      requires_delivery,
      vehicleId,
      vehicleIds,
    } = filters;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);
    const where: Prisma.one_off_purchaseWhereInput = {
      is_active: true, // Solo mostrar compras activas
    };

    if (person_id) where.person_id = person_id;
    if (product_id) where.product_id = product_id;
    if (sale_channel_id) where.sale_channel_id = sale_channel_id;
    if (locality_id) where.locality_id = locality_id;
    if (zone_id) where.zone_id = zone_id;

    // Filtro por vehículo a través de route_sheet_detail
    if (vehicleId || (vehicleIds && vehicleIds.length > 0)) {
      const vehicleFilter = vehicleId
        ? { equals: vehicleId }
        : { in: vehicleIds };

      where.route_sheet_detail = {
        some: {
          route_sheet: {
            vehicle_id: vehicleFilter,
          },
        },
      };
    }

    // Manejar filtrado por estados (múltiples o único)
    if (statuses && statuses.length > 0) {
      // Si se proporcionan múltiples estados, usar operador IN
      where.status = { in: statuses };
    } else if (status) {
      // Si solo se proporciona un estado (compatibilidad), usar equality
      where.status = status;
    }

    if (requires_delivery !== undefined)
      where.requires_delivery = requires_delivery;

    const personFilter: Prisma.personWhereInput = {};
    if (customerName) {
      personFilter.name = { contains: customerName, mode: 'insensitive' };
    }
    if (Object.keys(personFilter).length > 0) {
      where.person = personFilter;
    }

    const productFilter: Prisma.productWhereInput = {};
    if (productName) {
      productFilter.description = {
        contains: productName,
        mode: 'insensitive',
      };
    }
    if (Object.keys(productFilter).length > 0) {
      where.product = productFilter;
    }

    if (search) {
      const searchNum = parseInt(search);
      const orConditions: Prisma.one_off_purchaseWhereInput[] = [
        { person: { name: { contains: search, mode: 'insensitive' } } },
        { product: { description: { contains: search, mode: 'insensitive' } } },
      ];
      if (!isNaN(searchNum)) {
        orConditions.push({ purchase_id: searchNum });
      }
      if (where.OR) {
        where.OR = where.OR.concat(orConditions);
      } else {
        where.OR = orConditions;
      }
    }

    // Validación de rangos de fechas de compra
    if (purchaseDateFrom && purchaseDateTo) {

      const fromDate = new Date(purchaseDateFrom);
      const toDate = new Date(purchaseDateTo);
      if (toDate < fromDate) {
        throw new BadRequestException(
          'La fecha de compra "hasta" no puede ser menor que la fecha de compra "desde"',
        );
      }
    }

    // Validación de rangos de fechas de entrega
    if (deliveryDateFrom && deliveryDateTo) {
      const fromDate = new Date(deliveryDateFrom);
      const toDate = new Date(deliveryDateTo);
      if (toDate < fromDate) {
        throw new BadRequestException(
          'La fecha de entrega "hasta" no puede ser menor que la fecha de entrega "desde"',
        );
      }
    }

    if (purchaseDateFrom || purchaseDateTo) {
      where.purchase_date = {};

      if (purchaseDateFrom) {
        const fromDate = new Date(purchaseDateFrom);
        fromDate.setHours(0, 0, 0, 0);
        where.purchase_date.gte = fromDate;
      }
      if (purchaseDateTo) {
        const toDate = new Date(purchaseDateTo);
        toDate.setHours(23, 59, 59, 999);
        where.purchase_date.lte = toDate;
      }

      // Log para debugging del filtrado de fechas
      if (purchaseDateFrom && purchaseDateTo) {

      }
    }

    // Filtros de fecha de entrega
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

    const orderBy = parseSortByString(
      sortBy,
      [{ purchase_date: 'desc' }],
      mapOneOffSortFields,
    );

    try {
      const total = await this.one_off_purchase.count({ where });
      const purchases = await this.one_off_purchase.findMany({
        where,
        include: {
          product: true,
          person: true,
          sale_channel: true,
          locality: true,
          zone: true,
          price_list: true,
        },
        orderBy,
        skip,
        take,
      });
      // Agrupar compras por orden (person_id + fecha)
      const groupedPurchases = this.groupPurchasesByOrder(purchases);

      // Convertir a formato de respuesta consolidado con pagos cargados
      const consolidatedOrders = await Promise.all(
        Array.from(groupedPurchases.values()).map(async (group) => {
          // Cargar pagos para cada grupo de compras
          const basePurchase = group[0];
          const payments = await this.loadPaymentTransactions(
            basePurchase.person_id,
            basePurchase.purchase_id,
            true, // isLegacyStructure = true
          );

          // Agregar pagos a las compras
          group.forEach((purchase) => {
            purchase.payment_transaction = payments;
          });

          return this.mapToConsolidatedOneOffPurchaseResponseDto(group);
        }),
      );

      return {
        data: consolidatedOrders,
        meta: {
          total: groupedPurchases.size, // Total de órdenes consolidadas
          page,
          limit: take,
          totalPages: Math.ceil(groupedPurchases.size / take),
        },
      };
    } catch (error) {
      handlePrismaError(error, 'Compras One-Off');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al buscar compras one-off`,
        );
      }
      throw error;
    }
  }

  async findOneOneOff(id: number): Promise<OneOffPurchaseResponseDto> {
    try {
      // 🆕 BÚSQUEDA PARALELA: Buscar en ambas estructuras simultáneamente
      const [legacyPurchase, headerPurchase] = await Promise.all([
        // Buscar en estructura legacy
        this.one_off_purchase
          .findUnique({
            where: { purchase_id: id },
            include: {
              product: true,
              person: true,
              sale_channel: true,
              locality: true,
              zone: true,
              price_list: true,
              // Removed payment_transaction include - not available for one_off_purchase
            },
          })
          .catch(() => null), // No lanzar error, solo retornar null

        // Buscar en estructura header
        this.one_off_purchase_header
          .findUnique({
            where: { purchase_header_id: id },
            include: {
              person: true,
              sale_channel: true,
              locality: true,
              zone: true,
              purchase_items: {
                include: {
                  product: true,
                  price_list: true,
                },
              },
              // Las transacciones de pago se cargarán por separado basándose en customer_id y document_number
            },
          })
          .catch(() => null), // No lanzar error, solo retornar null
      ]);

      // Si se encuentra en legacy, usar lógica de consolidación
      if (legacyPurchase) {
        const purchaseDate = new Date(legacyPurchase.purchase_date);
        const startOfDay = new Date(purchaseDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(purchaseDate);
        endOfDay.setHours(23, 59, 59, 999);

        const relatedPurchases = await this.one_off_purchase.findMany({
          where: {
            person_id: legacyPurchase.person_id,
            purchase_date: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          include: {
            product: true,
            person: true,
            sale_channel: true,
            locality: true,
            zone: true,
            price_list: true,
            // Removed payment_transaction include - not available for one_off_purchase
          },
          orderBy: { purchase_id: 'asc' },
        });

        // Cargar pagos para las compras relacionadas
        const payments = await this.loadPaymentTransactions(
          legacyPurchase.person_id,
          legacyPurchase.purchase_id,
          true, // isLegacyStructure = true
        );

        // Agregar pagos a las compras
        relatedPurchases.forEach((purchase) => {
          (purchase as any).payment_transaction = payments;
        });

        return this.mapToConsolidatedOneOffPurchaseResponseDto(
          relatedPurchases,
        );
      }

      // Si se encuentra en header, usar mapeo directo
      if (headerPurchase) {
        return await this.mapToHeaderItemsOneOffPurchaseResponseDto(
          headerPurchase,
        );
      }

      // Si no se encuentra en ninguna estructura, lanzar error
      throw new NotFoundException(
        `Compra One-Off con ID ${id} no encontrada en ninguna de las estructuras disponibles.`,
      );
    } catch (error) {
      handlePrismaError(error, 'Compra One-Off');
      if (
        !(
          error instanceof NotFoundException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al buscar compra one-off por ID ${id}.`,
        );
      }
      throw error;
    }
  }

  async updateOneOff(
    id: number,
    updateDto: UpdateOneOffPurchaseDto,
  ): Promise<OneOffPurchaseResponseDto> {
    try {
      return await this.$transaction(async (prismaTx) => {
        // 🆕 BÚSQUEDA PARALELA: Buscar en ambas estructuras como en findOneOneOff
        const [legacyPurchase, headerPurchase] = await Promise.all([
          // Buscar en estructura legacy
          prismaTx.one_off_purchase
            .findUnique({
              where: { purchase_id: id },
              include: { product: true },
            })
            .catch(() => null),

          // Buscar en estructura header
          prismaTx.one_off_purchase_header
            .findUnique({
              where: { purchase_header_id: id },
              include: {
                purchase_items: {
                  include: {
                    product: true,
                  },
                },
              },
            })
            .catch(() => null),
        ]);

        // Verificar que existe en alguna de las dos estructuras
        if (!legacyPurchase && !headerPurchase) {
          throw new NotFoundException(
            `Compra One-Off con ID ${id} no encontrada en ninguna de las estructuras disponibles.`,
          );
        }

        const existingPurchase = legacyPurchase || headerPurchase;

        await this.validateOneOffPurchaseData(updateDto, prismaTx);

        // Manejar actualización del cliente si se proporciona
        let updatedPersonId = existingPurchase.person_id;
        if (updateDto.customer) {
          // Buscar cliente existente por teléfono
          let existingPerson = null;
          if (updateDto.customer.phone) {
            existingPerson = await prismaTx.person.findFirst({
              where: { phone: updateDto.customer.phone },
            });
          }

          if (existingPerson) {
            // Actualizar cliente existente
            const updatedPerson = await prismaTx.person.update({
              where: { person_id: existingPerson.person_id },
              data: {
                ...(updateDto.customer.name && {
                  name: updateDto.customer.name,
                }),
                ...(updateDto.customer.alias && {
                  alias: updateDto.customer.alias,
                }),
                ...(updateDto.customer.address && {
                  address: updateDto.customer.address,
                }),
                ...(updateDto.customer.taxId && {
                  tax_id: updateDto.customer.taxId,
                }),
                ...(updateDto.customer.type && {
                  type: updateDto.customer.type as PersonType,
                }),
                ...(updateDto.customer.additionalPhones && {
                  additional_phones: updateDto.customer.additionalPhones,
                }),
                ...(updateDto.customer.localityId !== undefined && {
                  locality:
                    updateDto.customer.localityId === null ||
                    updateDto.customer.localityId === 0
                      ? { disconnect: true }
                      : {
                          connect: {
                            locality_id: updateDto.customer.localityId,
                          },
                        },
                }),
                ...(updateDto.customer.zoneId !== undefined && {
                  zone:
                    updateDto.customer.zoneId === null ||
                    updateDto.customer.zoneId === 0
                      ? { disconnect: true }
                      : { connect: { zone_id: updateDto.customer.zoneId } },
                }),
              },
            });
            updatedPersonId = updatedPerson.person_id;
          } else if (updateDto.customer.phone && updateDto.customer.name) {
            // Crear nuevo cliente
            const newPerson = await prismaTx.person.create({
              data: {
                name: updateDto.customer.name,
                phone: updateDto.customer.phone,
                alias: updateDto.customer.alias || '',
                address: updateDto.customer.address || '',
                tax_id: updateDto.customer.taxId || '',
                type:
                  (updateDto.customer.type as PersonType) ||
                  PersonType.INDIVIDUAL,
                additional_phones: updateDto.customer.additionalPhones || '',
                ...(updateDto.customer.localityId && {
                  locality: {
                    connect: { locality_id: updateDto.customer.localityId },
                  },
                }),
                ...(updateDto.customer.zoneId && {
                  zone: { connect: { zone_id: updateDto.customer.zoneId } },
                }),
              },
            });
            updatedPersonId = newPerson.person_id;
          }
        }

        // Variables para manejo de productos (opcional en actualización)
        // Determinar si estamos trabajando con estructura legacy o header
        const isLegacyStructure = !!legacyPurchase;
        const isHeaderStructure = !!headerPurchase;

        let newQuantity =
          existingPurchase.quantity ||
          (headerPurchase ? headerPurchase.purchase_items[0]?.quantity : 0);
        let newTotalAmount =
          existingPurchase.total_amount || headerPurchase?.total_amount;
        let quantityChange = 0;
        let productForUpdate = null;
        let priceListId =
          existingPurchase.price_list_id ||
          (headerPurchase
            ? headerPurchase.purchase_items[0]?.price_list_id
            : null);

        // Solo procesar items si se proporcionan
        if (updateDto.items && updateDto.items.length > 0) {
          // Tomar el primer item (limitación actual del sistema)
          const firstItem = updateDto.items[0];
          productForUpdate = await prismaTx.product.findUniqueOrThrow({
            where: { product_id: firstItem.product_id },
          });

          newQuantity = firstItem.quantity;
          quantityChange = newQuantity - existingPurchase.quantity;

          // Determinar la lista de precios a usar
          priceListId =
            firstItem.price_list_id ||
            existingPurchase.price_list_id ||
            BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;

          // Buscar precio en la lista seleccionada, si no existe usar precio base
          let itemPrice = new Decimal(productForUpdate.price); // Precio base como fallback

          const priceItem = await prismaTx.price_list_item.findFirst({
            where: {
              price_list_id: priceListId,
              product_id: productForUpdate.product_id,
            },
          });

          if (priceItem) {
            itemPrice = new Decimal(priceItem.unit_price);
          }

          // Calcular el total amount basado en el producto
          newTotalAmount = itemPrice.mul(newQuantity);
        }

        // Si se proporciona total_amount en el DTO, usarlo en su lugar
        if (updateDto.total_amount) {
          newTotalAmount = new Decimal(updateDto.total_amount);
        }

        // Validar stock solo si hay cambio de cantidad y producto no retornable
        if (
          productForUpdate &&
          !productForUpdate.is_returnable &&
          quantityChange !== 0
        ) {
          const stockDisponible = await this.inventoryService.getProductStock(
            productForUpdate.product_id,
            BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
            prismaTx,
          );
          if (quantityChange > 0 && stockDisponible < quantityChange) {
            throw new BadRequestException(
              `Compra One-Off: Stock insuficiente para ${productForUpdate.description}. Se necesita ${quantityChange} adicional, disponible: ${stockDisponible}.`,
            );
          }
        }

        const dataToUpdate: Prisma.one_off_purchaseUpdateInput = {
          ...(productForUpdate && {
            product: { connect: { product_id: productForUpdate.product_id } },
          }),
          quantity: newQuantity,
          price_list: { connect: { price_list_id: priceListId } },
          ...(updatedPersonId !== existingPurchase.person_id && {
            person: { connect: { person_id: updatedPersonId } },
          }),
          ...(updateDto.requires_delivery !== undefined && {
            requires_delivery: updateDto.requires_delivery,
          }),
          ...(updateDto.delivery_address !== undefined && {
            delivery_address: updateDto.delivery_address,
          }),
          ...(updateDto.sale_channel_id && {
            sale_channel: {
              connect: { sale_channel_id: updateDto.sale_channel_id },
            },
          }),
          ...(updateDto.locality_id !== undefined && {
            locality:
              updateDto.locality_id === null || updateDto.locality_id === 0
                ? { disconnect: true }
                : { connect: { locality_id: updateDto.locality_id } },
          }),
          ...(updateDto.zone_id !== undefined && {
            zone:
              updateDto.zone_id === null || updateDto.zone_id === 0
                ? { disconnect: true }
                : { connect: { zone_id: updateDto.zone_id } },
          }),
          purchase_date: updateDto.purchase_date
            ? new Date(updateDto.purchase_date)
            : existingPurchase.purchase_date,
          ...(updateDto.scheduled_delivery_date !== undefined && {
            scheduled_delivery_date:
              updateDto.scheduled_delivery_date &&
              updateDto.scheduled_delivery_date.trim() !== ''
                ? new Date(updateDto.scheduled_delivery_date)
                : null,
          }),
          ...(updateDto.delivery_time !== undefined && {
            delivery_time: updateDto.delivery_time,
          }),
          ...(updateDto.paid_amount !== undefined && {
            paid_amount: updateDto.paid_amount
              ? new Decimal(updateDto.paid_amount)
              : new Decimal(0),
          }),
          ...(updateDto.notes !== undefined && { notes: updateDto.notes }),
          ...(updateDto.status !== undefined && { status: updateDto.status }),
          total_amount: newTotalAmount,
        };

        // Filtrar undefined para no sobreescribir con null innecesariamente
        Object.keys(dataToUpdate).forEach(
          (key) =>
            (dataToUpdate as any)[key] === undefined &&
            delete (dataToUpdate as any)[key],
        );

        let updatedPurchase;

        if (isLegacyStructure) {
          // Actualizar estructura legacy
          updatedPurchase = await prismaTx.one_off_purchase.update({
            where: { purchase_id: id },
            data: dataToUpdate,
            include: {
              product: true,
              person: true,
              sale_channel: true,
              locality: true,
              zone: true,
              price_list: true,
            },
          });
        } else if (isHeaderStructure) {
          // Para estructura header, necesitamos actualizar tanto el header como los items
          // Primero actualizar el header
          const headerDataToUpdate: Prisma.one_off_purchase_headerUpdateInput =
            {
              ...(updatedPersonId !== headerPurchase.person_id && {
                person: { connect: { person_id: updatedPersonId } },
              }),
              ...(updateDto.requires_delivery !== undefined && {
                requires_delivery: updateDto.requires_delivery,
              }),
              ...(updateDto.delivery_address !== undefined && {
                delivery_address: updateDto.delivery_address,
              }),
              ...(updateDto.sale_channel_id && {
                sale_channel: {
                  connect: { sale_channel_id: updateDto.sale_channel_id },
                },
              }),
              ...(updateDto.locality_id !== undefined && {
                locality:
                  updateDto.locality_id === null || updateDto.locality_id === 0
                    ? { disconnect: true }
                    : { connect: { locality_id: updateDto.locality_id } },
              }),
              ...(updateDto.zone_id !== undefined && {
                zone:
                  updateDto.zone_id === null || updateDto.zone_id === 0
                    ? { disconnect: true }
                    : { connect: { zone_id: updateDto.zone_id } },
              }),
              purchase_date: updateDto.purchase_date
                ? new Date(updateDto.purchase_date)
                : headerPurchase.purchase_date,
              ...(updateDto.scheduled_delivery_date !== undefined && {
                scheduled_delivery_date:
                  updateDto.scheduled_delivery_date &&
                  updateDto.scheduled_delivery_date.trim() !== ''
                    ? new Date(updateDto.scheduled_delivery_date)
                    : null,
              }),
              ...(updateDto.delivery_time !== undefined && {
                delivery_time: updateDto.delivery_time,
              }),
              ...(updateDto.paid_amount !== undefined && {
                paid_amount: updateDto.paid_amount
                  ? new Decimal(updateDto.paid_amount)
                  : new Decimal(0),
              }),
              ...(updateDto.notes !== undefined && { notes: updateDto.notes }),
              ...(updateDto.status !== undefined && {
                status: updateDto.status,
              }),
              total_amount: newTotalAmount,
            };

          updatedPurchase = await prismaTx.one_off_purchase_header.update({
            where: { purchase_header_id: id },
            data: headerDataToUpdate,
            include: {
              purchase_items: {
                include: {
                  product: true,
                },
              },
              person: true,
              sale_channel: true,
              locality: true,
              zone: true,
            },
          });

          // Si hay items para actualizar, actualizar el primer item
          if (
            updateDto.items &&
            updateDto.items.length > 0 &&
            headerPurchase.purchase_items.length > 0
          ) {
            const firstItem = updateDto.items[0];
            await prismaTx.one_off_purchase_item.update({
              where: {
                purchase_item_id:
                  headerPurchase.purchase_items[0].purchase_item_id,
              },
              data: {
                ...(productForUpdate && {
                  product: {
                    connect: { product_id: productForUpdate.product_id },
                  },
                }),
                quantity: newQuantity,
                price_list: { connect: { price_list_id: priceListId } },
              },
            });
          }
        }

        // Crear movimiento de stock solo si hay producto actualizado y cambio de cantidad
        if (
          productForUpdate &&
          !productForUpdate.is_returnable &&
          quantityChange !== 0
        ) {
          const movementTypeId =
            quantityChange > 0
              ? await this.inventoryService.getMovementTypeIdByCode(
                  BUSINESS_CONFIG.MOVEMENT_TYPES.EGRESO_VENTA_UNICA,
                  prismaTx,
                )
              : await this.inventoryService.getMovementTypeIdByCode(
                  BUSINESS_CONFIG.MOVEMENT_TYPES
                    .INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA,
                  prismaTx,
                );

          const stockMovement: CreateStockMovementDto = {
            movement_type_id: movementTypeId,
            product_id: productForUpdate.product_id,
            quantity: Math.abs(quantityChange),
            ...(quantityChange > 0
              ? {
                  source_warehouse_id:
                    BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                }
              : {
                  destination_warehouse_id:
                    BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                }),
            movement_date: new Date(),
            remarks: `Compra One-Off #${id} ACTUALIZADA - ${productForUpdate.description} (${quantityChange > 0 ? 'Venta' : 'Devolución'})`,
          };
          await this.inventoryService.createStockMovement(
            stockMovement,
            prismaTx,
          );
        }

        // Retornar el resultado mapeado según la estructura
        if (isLegacyStructure) {
          return await this.mapToOneOffPurchaseResponseDto(updatedPurchase);
        } else {
          return await this.mapToHeaderItemsOneOffPurchaseResponseDto(
            updatedPurchase,
          );
        }
      });
    } catch (error) {
      handlePrismaError(error, 'Compra One-Off');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al actualizar compra one-off`,
        );
      }
      throw error;
    }
  }

  async removeOneOff(
    id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    try {
      // 🆕 BÚSQUEDA PARALELA: Buscar en ambas estructuras simultáneamente
      const [legacyPurchase, headerPurchase] = await Promise.all([
        // Buscar en estructura legacy
        this.one_off_purchase
          .findUnique({
            where: { purchase_id: id },
            include: { product: true },
          })
          .catch(() => null),

        // Buscar en estructura header
        this.one_off_purchase_header
          .findUnique({
            where: { purchase_header_id: id },
            include: {
              purchase_items: {
                include: { product: true },
              },
            },
          })
          .catch(() => null),
      ]);

      // Verificar que al menos una estructura tenga el registro
      if (!legacyPurchase && !headerPurchase) {
        throw new NotFoundException(
          `Compra One-Off con ID ${id} no encontrada en ninguna de las estructuras disponibles.`,
        );
      }

      const purchase = legacyPurchase || headerPurchase;

      // 🆕 VALIDACIÓN PREVIA: Verificar si la compra está en alguna hoja de ruta (ambas estructuras)
      const routeSheetReferences = await this.route_sheet_detail.findMany({
        where: {
          OR: [
            { one_off_purchase_id: id }, // Estructura legacy
            { one_off_purchase_header_id: id }, // Estructura header
          ],
        },
        include: {
          route_sheet: {
            include: {
              driver: { select: { name: true } },
              vehicle: { select: { name: true } },
            },
          },
        },
      });

      if (routeSheetReferences.length > 0) {
        // Construir un mensaje más informativo con detalles de las hojas de ruta
        const routeInfo = routeSheetReferences
          .map((ref) => {
            const routeSheet = ref.route_sheet;
            const driverName =
              routeSheet.driver?.name || 'Conductor no asignado';
            const vehicleName =
              routeSheet.vehicle?.name || 'Vehículo no asignado';
            const deliveryDate =
              routeSheet.delivery_date.toLocaleDateString('es-ES');
            return `Hoja de Ruta #${routeSheet.route_sheet_id} (${deliveryDate}) - ${driverName} - ${vehicleName}`;
          })
          .join(', ');

        throw new ConflictException(
          `No se puede eliminar la Compra One-Off #${id} porque está incluida en ${routeSheetReferences.length} hoja(s) de ruta activa(s): ${routeInfo}. ` +
            `Para eliminar esta compra, primero debe removerla de las hojas de ruta correspondientes o eliminar las hojas de ruta completas.`,
        );
      }

      await this.$transaction(async (prismaTx) => {
        // 🆕 RENOVAR STOCK: Manejar ambas estructuras
        if (legacyPurchase) {
          // Renovar stock para estructura legacy
          await this.renewStockForNonReturnableProducts(
            [
              {
                product_id: legacyPurchase.product_id,
                quantity: legacyPurchase.quantity,
                product: legacyPurchase.product,
              },
            ],
            `Compra One-Off Legacy #${id}`,
            prismaTx,
          );

          // Soft delete: cambiar is_active a false en lugar de eliminar físicamente
          await prismaTx.one_off_purchase.update({
            where: { purchase_id: id },
            data: { is_active: false },
          });
        } else if (headerPurchase) {
          // Renovar stock para estructura header (múltiples items)
          const items = headerPurchase.purchase_items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            product: item.product,
          }));

          await this.renewStockForNonReturnableProducts(
            items,
            `Compra One-Off Header #${id}`,
            prismaTx,
          );

          // Soft delete: cambiar is_active a false en lugar de eliminar físicamente
          await prismaTx.one_off_purchase_header.update({
            where: { purchase_header_id: id },
            data: { is_active: false },
          });
        }
      });

      const structureType = legacyPurchase ? 'legacy' : 'header';
      return {
        message: `Compra One-Off con ID ${id} (estructura ${structureType}) desactivada exitosamente. El stock de productos no retornables ha sido renovado.`,
        deleted: true,
      };
    } catch (error) {
      handlePrismaError(error, 'Compra One-Off');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al eliminar compra one-off`,
        );
      }
      throw error;
    }
  }

  // ===== ONE-OFF PURCHASES METHODS =====
  private async renewStockForNonReturnableProducts(
    items: Array<{
      product_id: number;
      quantity: number;
      product: { is_returnable: boolean; description: string };
    }>,
    purchaseReference: string,
    prismaTx: any,
  ): Promise<void> {
    const returnMovementTypeId =
      await this.inventoryService.getMovementTypeIdByCode(
        BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_VENTA_UNICA_CANCELADA,
        prismaTx,
      );

    for (const item of items) {
      if (item.quantity > 0 && !item.product.is_returnable) {
        await this.inventoryService.createStockMovement(
          {
            movement_type_id: returnMovementTypeId,
            product_id: item.product_id,
            quantity: item.quantity,
            source_warehouse_id: null,
            destination_warehouse_id:
              BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
            movement_date: new Date(),
            remarks: `${purchaseReference} CANCELADA - Devolución producto no retornable ${item.product.description} (ID ${item.product_id})`,
          },
          prismaTx,
        );
      }
    }
  }

  private groupPurchasesByOrder(purchases: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const purchase of purchases) {
      // Agrupar por person_id y fecha de compra (mismo día)
      const purchaseDate = new Date(purchase.purchase_date);
      const dateKey = purchaseDate.toISOString().split('T')[0]; // Solo fecha, sin hora
      const groupKey = `${purchase.person_id}-${dateKey}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey).push(purchase);
    }

    return grouped;
  }

  private mapToConsolidatedOneOffPurchaseResponseDto(
    purchases: any[],
  ): OneOffPurchaseResponseDto {
    if (!purchases || purchases.length === 0) {
      throw new BadRequestException('No hay compras para consolidar');
    }
    // Usar la primera compra como base para los datos comunes
    const basePurchase = purchases[0];

    // Calcular el total consolidado
    const totalAmount = purchases.reduce(
      (sum, purchase) => sum.add(purchase.total_amount),
      new Decimal(0),
    );

    // Calcular información de pagos consolidada
    const paidAmount = new Decimal(basePurchase.paid_amount || 0);
    const remainingAmount = totalAmount.minus(paidAmount);

    // Determinar estado de pago
    let paymentStatus = 'PENDING';
    if (totalAmount.equals(0)) {
      // Si el total es 0, no hay nada que pagar
      paymentStatus = 'NONE';
    } else if (paidAmount.equals(0)) {
      paymentStatus = 'PENDING';
    } else if (paidAmount.greaterThanOrEqualTo(totalAmount)) {
      paymentStatus = 'PAID';
    } else {
      paymentStatus = 'PARTIAL';
    }

    // Consolidar transacciones de pago de todas las compras
    const allPayments = purchases.flatMap((purchase) =>
      (purchase.payment_transaction || []).map((payment: any) => ({
        payment_id: payment.transaction_id || payment.payment_id,
        amount: (payment.transaction_amount || payment.amount || 0).toString(),
        payment_date: payment.transaction_date
          ? payment.transaction_date.toISOString()
          : new Date().toISOString(),
        payment_method:
          payment.payment_method?.description ||
          payment.payment_method ||
          'No especificado',
        transaction_reference:
          payment.receipt_number || payment.reference || undefined,
        notes: payment.notes || undefined,
      })),
    );

    // Consolidar todos los productos
    const products = purchases.map((purchase) => {
      const unitPrice = purchase.total_amount.div(purchase.quantity);
      const subtotal = purchase.total_amount;

      return {
        product_id: purchase.product.product_id,
        description: purchase.product.description,
        quantity: purchase.quantity,
        unit_price: unitPrice.toString(),
        subtotal: subtotal.toString(),
        price_list_id: purchase.price_list?.price_list_id || null,
      };
    });

    return {
      purchase_id: basePurchase.purchase_id,
      person_id: basePurchase.person_id,
      purchase_date: basePurchase.purchase_date.toISOString(),
      scheduled_delivery_date:
        basePurchase.scheduled_delivery_date?.toISOString(),
      delivery_time: basePurchase.delivery_time,
      total_amount: totalAmount.toString(),
      paid_amount: basePurchase.paid_amount.toString(),
      status: basePurchase.status,
      traffic_light_status: this.calculateTrafficLightStatus(
        basePurchase.purchase_date,
      ),
      requires_delivery: basePurchase.requires_delivery,
      notes: basePurchase.notes,
      delivery_address: basePurchase.delivery_address || undefined,
      payment_status: paymentStatus,
      remaining_amount: remainingAmount.toString(),
      payments: allPayments,
      person: {
        person_id: basePurchase.person.person_id,
        name: basePurchase.person.name || 'Nombre no disponible',
        phone: basePurchase.person.phone || '',
        address: basePurchase.person.address || undefined,
      },
      products: products,
      sale_channel: {
        sale_channel_id: basePurchase.sale_channel.sale_channel_id,
        name: basePurchase.sale_channel.description || 'Canal no disponible',
      },
      locality:
        basePurchase.requires_delivery && basePurchase.locality
          ? {
              locality_id: basePurchase.locality.locality_id,
              name: basePurchase.locality.name,
            }
          : undefined,
      zone:
        basePurchase.requires_delivery && basePurchase.zone
          ? {
              zone_id: basePurchase.zone.zone_id,
              name: basePurchase.zone.name,
            }
          : undefined,
      order_type: OrderType.ONE_OFF,
    };
  }

  /**
   * Calcula el estado del semáforo basado en días transcurridos desde la fecha del pedido
   * Verde: < 5 días, Amarillo: 5-10 días, Rojo: > 10 días
   */
  private calculateTrafficLightStatus(purchaseDate: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - purchaseDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 5) {
      return 'green';
    } else if (diffDays <= 10) {
      return 'yellow';
    } else {
      return 'red';
    }
  }

  private async mapToOneOffPurchaseResponseDto(
    purchase: any,
    payments?: any[],
  ): Promise<OneOffPurchaseResponseDto> {
    // Calcular información de pagos
    const totalAmount = new Decimal(purchase.total_amount);
    const paidAmount = new Decimal(purchase.paid_amount || 0);
    const remainingAmount = totalAmount.minus(paidAmount);

    // Determinar estado de pago
    let paymentStatus = 'PENDING';
    if (totalAmount.equals(0)) {
      // Si el total es 0, no hay nada que pagar
      paymentStatus = 'NONE';
    } else if (paidAmount.equals(0)) {
      paymentStatus = 'PENDING';
    } else if (paidAmount.greaterThanOrEqualTo(totalAmount)) {
      paymentStatus = 'PAID';
    } else {
      paymentStatus = 'PARTIAL';
    }

    // CORRECCIÓN: Siempre cargar pagos para asegurar que no estén vacíos
    let paymentTransactions = payments;
    if (!paymentTransactions) {
      const orderIdValue = purchase.purchase_id || purchase.purchase_header_id;
      try {
        paymentTransactions = await this.loadPaymentTransactions(
          purchase.person_id,
          orderIdValue,
          !!purchase.purchase_id,
        );
      } catch (error) {
        this.logger.error(
          `Error cargando pagos para orden ${orderIdValue}:`,
          error.message,
        );
        paymentTransactions = [];
      }
    }

    // Mapear transacciones de pago con mejor manejo de errores
    const mappedPayments = (paymentTransactions || []).map((payment: any) => ({
      payment_id:
        payment.transaction_id ||
        payment.payment_transaction_id ||
        payment.payment_id,
      amount: (payment.transaction_amount || payment.amount || 0).toString(),
      payment_date: (
        payment.transaction_date ||
        payment.payment_date ||
        new Date()
      ).toISOString(),
      payment_method:
        payment.payment_method?.description ||
        payment.payment_method ||
        'No especificado',
      transaction_reference:
        payment.receipt_number ||
        payment.transaction_reference ||
        payment.reference ||
        undefined,
      notes: payment.notes || undefined,
    }));

    return {
      purchase_id: purchase.purchase_id,
      person_id: purchase.person_id,
      purchase_date: purchase.purchase_date.toISOString(),
      scheduled_delivery_date: purchase.scheduled_delivery_date?.toISOString(),
      delivery_time: purchase.delivery_time,
      total_amount: purchase.total_amount.toString(),
      paid_amount: purchase.paid_amount.toString(),
      status: purchase.status,
      order_type: OrderType.ONE_OFF,
      traffic_light_status: this.calculateTrafficLightStatus(
        purchase.purchase_date,
      ),
      requires_delivery: purchase.requires_delivery,
      notes: purchase.notes,
      delivery_address: purchase.delivery_address || undefined,
      payment_status: paymentStatus,
      remaining_amount: remainingAmount.toString(),
      payments: mappedPayments,
      person: {
        person_id: purchase.person.person_id,
        name: purchase.person.name || 'Nombre no disponible',
        phone: purchase.person.phone || '',
        address: purchase.person.address || undefined,
      },
      products: [
        {
          product_id: purchase.product.product_id,
          description: purchase.product.description,
          quantity: purchase.quantity,
          unit_price: purchase.total_amount.div(purchase.quantity).toString(),
          subtotal: purchase.total_amount.toString(),
          price_list_id: purchase.price_list?.price_list_id || null,
        },
      ],
      sale_channel: {
        sale_channel_id: purchase.sale_channel.sale_channel_id,
        name: purchase.sale_channel.description || 'Canal no disponible',
      },
      locality:
        purchase.requires_delivery && purchase.locality
          ? {
              locality_id: purchase.locality.locality_id,
              name: purchase.locality.name,
            }
          : undefined,
      zone:
        purchase.requires_delivery && purchase.zone
          ? {
              zone_id: purchase.zone.zone_id,
              name: purchase.zone.name,
            }
          : undefined,
    };
  }

  private async mapToHeaderItemsOneOffPurchaseResponseDto(
    purchaseHeader: any,
  ): Promise<OneOffPurchaseResponseDto> {
    // Calcular información de pagos
    const totalAmount = new Decimal(purchaseHeader.total_amount);
    const paidAmount = new Decimal(purchaseHeader.paid_amount || 0);
    const remainingAmount = totalAmount.minus(paidAmount);

    // Determinar estado de pago
    let paymentStatus = 'PENDING';
    if (totalAmount.equals(0)) {
      // Si el total es 0, no hay nada que pagar
      paymentStatus = 'NONE';
    } else if (paidAmount.equals(0)) {
      paymentStatus = 'PENDING';
    } else if (paidAmount.greaterThanOrEqualTo(totalAmount)) {
      paymentStatus = 'PAID';
    } else {
      paymentStatus = 'PARTIAL';
    }

    // CORRECCIÓN: Cargar pagos desde payment_transaction si no están incluidos
    let payments = [];
    if (
      purchaseHeader.payment_transaction &&
      purchaseHeader.payment_transaction.length > 0
    ) {
      payments = purchaseHeader.payment_transaction.map((payment: any) => ({
        payment_id:
          payment.payment_transaction_id ||
          payment.transaction_id ||
          payment.payment_id,
        amount: (payment.amount || payment.transaction_amount || 0).toString(),
        payment_date: payment.payment_date
          ? payment.payment_date.toISOString()
          : new Date().toISOString(),
        payment_method:
          payment.payment_method?.description ||
          payment.payment_method ||
          'No especificado',
        transaction_reference:
          payment.transaction_reference ||
          payment.receipt_number ||
          payment.reference ||
          undefined,
        notes: payment.notes || undefined,
      }));
    } else {
      // Cargar pagos manualmente si no están incluidos en la query
      try {
        const paymentTransactions = await this.loadPaymentTransactions(
          purchaseHeader.person_id,
          purchaseHeader.purchase_header_id,
          false, // Es estructura header
        );

        payments = (paymentTransactions || []).map((payment: any) => ({
          payment_id: payment.transaction_id || payment.payment_id,
          amount: (
            payment.transaction_amount ||
            payment.amount ||
            0
          ).toString(),
          payment_date: payment.transaction_date
            ? payment.transaction_date.toISOString()
            : new Date().toISOString(),
          payment_method:
            payment.payment_method?.description ||
            payment.payment_method ||
            'No especificado',
          transaction_reference:
            payment.receipt_number || payment.reference || undefined,
          notes: payment.notes || undefined,
        }));
      } catch (error) {
        this.logger.error(
          `Error cargando pagos para header ${purchaseHeader.purchase_header_id}:`,
          error.message,
        );
        payments = [];
      }
    }

    return {
      purchase_id: purchaseHeader.purchase_header_id,
      person_id: purchaseHeader.person_id,
      purchase_date: purchaseHeader.purchase_date.toISOString(),
      scheduled_delivery_date:
        purchaseHeader.scheduled_delivery_date?.toISOString(),
      delivery_time: purchaseHeader.delivery_time,
      total_amount: purchaseHeader.total_amount.toString(),
      paid_amount: purchaseHeader.paid_amount.toString(),
      status: purchaseHeader.status,
      order_type: OrderType.ONE_OFF,
      traffic_light_status: this.calculateTrafficLightStatus(
        purchaseHeader.purchase_date,
      ),
      requires_delivery: !!purchaseHeader.delivery_address,
      notes: purchaseHeader.notes,
      delivery_address: purchaseHeader.delivery_address || undefined,
      payment_status: paymentStatus,
      remaining_amount: remainingAmount.toString(),
      payments: payments,
      person: {
        person_id: purchaseHeader.person.person_id,
        name: purchaseHeader.person.name || 'Nombre no disponible',
        phone: purchaseHeader.person.phone || '',
        address: purchaseHeader.person.address || undefined,
      },
      products: purchaseHeader.purchase_items.map((item: any) => ({
        product_id: item.product.product_id,
        description: item.product.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        price_list_id: item.price_list?.price_list_id || null,
      })),
      sale_channel: {
        sale_channel_id: purchaseHeader.sale_channel.sale_channel_id,
        name: purchaseHeader.sale_channel.description || 'Canal no disponible',
      },
      locality: purchaseHeader.locality
        ? {
            locality_id: purchaseHeader.locality.locality_id,
            name: purchaseHeader.locality.name,
          }
        : undefined,
      zone: purchaseHeader.zone
        ? {
            zone_id: purchaseHeader.zone.zone_id,
            name: purchaseHeader.zone.name,
          }
        : undefined,
    };
  }

  private async validateOneOffPurchaseData(
    dto: CreateOneOffPurchaseDto | UpdateOneOffPurchaseDto,
    tx?: Prisma.TransactionClient,
  ) {
    const prisma = tx || this;

    // Validar que hay items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Debe especificar al menos un producto en la compra.',
      );
    }

    // Validar productos por item
    for (const item of dto.items) {
      const product = await prisma.product.findUnique({
        where: { product_id: item.product_id },
      });
      if (!product)
        throw new NotFoundException(
          `Producto con ID ${item.product_id} no encontrado.`,
        );
    }

    // Validar canal de venta
    const saleChannel = await prisma.sale_channel.findUnique({
      where: { sale_channel_id: dto.sale_channel_id },
    });
    if (!saleChannel)
      throw new NotFoundException(
        `Canal de venta con ID ${dto.sale_channel_id} no encontrado.`,
      );

    // Validar localidad si se especifica
    if (dto.locality_id) {
      const locality = await prisma.locality.findUnique({
        where: { locality_id: dto.locality_id },
      });
      if (!locality)
        throw new NotFoundException(
          `Localidad con ID ${dto.locality_id} no encontrada.`,
        );
    }

    // Validar zona si se especifica
    if (dto.zone_id) {
      const zone = await prisma.zone.findUnique({
        where: { zone_id: dto.zone_id },
      });
      if (!zone)
        throw new NotFoundException(
          `Zona con ID ${dto.zone_id} no encontrada.`,
        );
    }
  }
  async findAllHeaderOneOff(filters: FilterOneOffPurchasesDto): Promise<any> {
    try {
      const {
        search,
        customerName,
        productName,
        page = 1,
        limit = 10,
        sortBy,
        purchaseDateFrom,
        purchaseDateTo,
        deliveryDateFrom,
        deliveryDateTo,
        person_id,
        sale_channel_id,
        locality_id,
        zone_id,
        status,
        statuses,
        requires_delivery,
        vehicleId,
        vehicleIds,
      } = filters;

      const where: Prisma.one_off_purchase_headerWhereInput = {
        is_active: true, // Solo mostrar compras activas
      };

      if (person_id) where.person_id = person_id;
      if (sale_channel_id) where.sale_channel_id = sale_channel_id;
      if (locality_id) where.locality_id = locality_id;
      if (zone_id) where.zone_id = zone_id;

      // Filtro por vehículo a través de route_sheet_detail
      if (vehicleId || (vehicleIds && vehicleIds.length > 0)) {
        const vehicleFilter = vehicleId
          ? { equals: vehicleId }
          : { in: vehicleIds };

        where.route_sheet_detail = {
          some: {
            route_sheet: {
              vehicle_id: vehicleFilter,
            },
          },
        };
      }

      // Manejar filtrado por estados (múltiples o único)
      if (statuses && statuses.length > 0) {
        // Si se proporcionan múltiples estados, usar operador IN
        where.status = { in: statuses };
      } else if (status) {
        // Si solo se proporciona un estado (compatibilidad), usar equality
        where.status = status;
      }

      if (requires_delivery !== undefined)
        where.requires_delivery = requires_delivery;

      const personFilter: Prisma.personWhereInput = {};
      if (customerName) {
        personFilter.name = { contains: customerName, mode: 'insensitive' };
      }
      if (Object.keys(personFilter).length > 0) {
        where.person = personFilter;
      }

      if (search) {
        const searchNum = parseInt(search);
        const orConditions: Prisma.one_off_purchase_headerWhereInput[] = [
          { person: { name: { contains: search, mode: 'insensitive' } } },
          { notes: { contains: search, mode: 'insensitive' } },
        ];

        if (!isNaN(searchNum)) {
          orConditions.push({ purchase_header_id: searchNum });
        }

        where.OR = orConditions;
      }

      if (purchaseDateFrom || purchaseDateTo) {
        where.purchase_date = {};
        if (purchaseDateFrom)
          where.purchase_date.gte = new Date(purchaseDateFrom);
        if (purchaseDateTo) {
          const endDate = new Date(purchaseDateTo);
          endDate.setHours(23, 59, 59, 999);
          where.purchase_date.lte = endDate;
        }
      }

      if (deliveryDateFrom || deliveryDateTo) {
        where.scheduled_delivery_date = {};
        if (deliveryDateFrom)
          where.scheduled_delivery_date.gte = new Date(deliveryDateFrom);
        if (deliveryDateTo) {
          const endDate = new Date(deliveryDateTo);
          endDate.setHours(23, 59, 59, 999);
          where.scheduled_delivery_date.lte = endDate;
        }
      }

      const orderBy = parseSortByString(
        sortBy,
        [{ purchase_date: 'desc' }],
        mapOneOffHeaderSortFields,
      );

      const headerPurchases = await this.one_off_purchase_header.findMany({
        where,
        include: {
          person: true,
          sale_channel: true,
          locality: true,
          zone: true,
          purchase_items: {
            include: {
              product: true,
              price_list: true,
            },
          },
        },
        orderBy,
      });

      // Convertir header/items al formato esperado con pagos cargados
      const convertedOrders = await Promise.all(
        headerPurchases.map(async (header) => {
          // Cargar pagos para cada header
          const payments = await this.loadPaymentTransactions(
            header.person_id,
            header.purchase_header_id,
            false, // isLegacyStructure = false
          );

          // Agregar pagos al header
          (header as any).payment_transaction = payments;

          return this.mapToHeaderItemsOneOffPurchaseResponseDto(header);
        }),
      );

      return {
        data: convertedOrders,
        meta: {
          total: convertedOrders.length,
          page,
          limit,
          totalPages: Math.ceil(convertedOrders.length / limit),
        },
      };
    } catch (error) {
      handlePrismaError(error, 'Compras One-Off Header');
      if (
        !(
          error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ConflictException ||
          error instanceof InternalServerErrorException
        )
      ) {
        throw new InternalServerErrorException(
          `Error no manejado al buscar compras one-off header`,
        );
      }
      throw error;
    }
  }
}
