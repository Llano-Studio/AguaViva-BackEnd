import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, ComodatoStatus } from '@prisma/client';
import { CreateComodatoDto } from '../../persons/dto/create-comodato.dto';
import { buildImageUrl } from '../../common/utils/file-upload.util';

export interface FirstCycleComodatoResult {
  comodatos_created: Array<{
    comodato_id: number;
    product_id: number;
    product_description: string;
    quantity: number;
    delivery_date: string;
  }>;
  total_comodatos: number;
  is_first_cycle: boolean;
  customer_id: number;
  subscription_id: number;
}

@Injectable()
export class FirstCycleComodatoService extends PrismaClient {
  private readonly logger = new Logger(FirstCycleComodatoService.name);

  async processFirstCycleComodato(
    subscriptionId: number,
    deliveryDate: Date,
  ): Promise<FirstCycleComodatoResult> {
    this.logger.log(
      `🔍 Verificando primer ciclo para suscripción ${subscriptionId}`,
    );

    // Verificar si es el primer ciclo
    const isFirstCycle = await this.isFirstCycle(subscriptionId);

    if (!isFirstCycle) {
      this.logger.log(
        `⏭️ No es el primer ciclo para suscripción ${subscriptionId}`,
      );
      return {
        comodatos_created: [],
        total_comodatos: 0,
        is_first_cycle: false,
        customer_id: 0,
        subscription_id: subscriptionId,
      };
    }

    this.logger.log(`✅ Es el primer ciclo para suscripción ${subscriptionId}`);

    // Obtener información de la suscripción y productos retornables
    const subscription = await this.customer_subscription.findUnique({
      where: { subscription_id: subscriptionId },
      include: {
        person: true,
        subscription_plan: {
          include: {
            subscription_plan_product: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    if (!subscription) {
      this.logger.error(`❌ Suscripción ${subscriptionId} no encontrada`);
      return {
        comodatos_created: [],
        total_comodatos: 0,
        is_first_cycle: true,
        customer_id: 0,
        subscription_id: subscriptionId,
      };
    }

    // Verificar si el cliente posee bidones propios
    if (subscription.person.owns_returnable_containers) {
      this.logger.log(
        `🏠 Cliente ${subscription.customer_id} posee bidones propios - No se crearán comodatos`,
      );
      return {
        comodatos_created: [],
        total_comodatos: 0,
        is_first_cycle: true,
        customer_id: subscription.customer_id,
        subscription_id: subscriptionId,
      };
    }

    // Filtrar productos retornables
    const returnableProducts =
      subscription.subscription_plan.subscription_plan_product.filter(
        (item) => item.product.is_returnable === true,
      );

    if (returnableProducts.length === 0) {
      this.logger.log(
        `ℹ️ No hay productos retornables en la suscripción ${subscriptionId}`,
      );
      return {
        comodatos_created: [],
        total_comodatos: 0,
        is_first_cycle: true,
        customer_id: subscription.customer_id,
        subscription_id: subscriptionId,
      };
    }

    this.logger.log(
      `📦 Encontrados ${returnableProducts.length} productos retornables para comodato`,
    );

    const productIds = returnableProducts.map((item) => item.product_id);
    const validation = await this.validateExistingComodatos(
      subscription.customer_id,
      productIds,
      subscriptionId,
    );

    if (validation.hasConflicts) {
      this.logger.warn(
        `⚠️ Se encontraron ${validation.conflicts.length} comodatos activos existentes para esta suscripción específica. Omitiendo productos con conflictos.`,
      );
      
      // Filtrar productos que no tienen conflictos en esta suscripción específica
      const conflictProductIds = validation.conflicts.map(c => c.product_id);
      const productsWithoutConflicts = returnableProducts.filter(
        (item) => !conflictProductIds.includes(item.product_id)
      );
      
      if (productsWithoutConflicts.length === 0) {
        this.logger.log(
          `ℹ️ Todos los productos retornables ya tienen comodatos activos para esta suscripción específica ${subscriptionId}`,
        );
        return {
          comodatos_created: [],
          total_comodatos: 0,
          is_first_cycle: true,
          customer_id: subscription.customer_id,
          subscription_id: subscriptionId,
        };
      }
      
      // Actualizar la lista de productos a procesar
      returnableProducts.splice(0, returnableProducts.length, ...productsWithoutConflicts);
      this.logger.log(
        `📦 Procesando ${returnableProducts.length} productos sin conflictos para esta suscripción`,
      );
    }

    // Crear comodatos para productos retornables
    const comodatosCreated = [];

    for (const planProduct of returnableProducts) {
      try {
        // Verificar si ya existe un comodato activo para este producto y suscripción específica
        const existingComodato = await this.comodato.findFirst({
          where: {
            person_id: subscription.customer_id,
            product_id: planProduct.product_id,
            subscription_id: subscriptionId,
            status: ComodatoStatus.ACTIVE,
            is_active: true,
          },
        });

        if (existingComodato) {
          this.logger.log(
            `⚠️ Ya existe comodato activo para producto ${planProduct.product.description} (ID: ${planProduct.product_id}) en esta suscripción ${subscriptionId}`,
          );
          continue;
        }

        // Log informativo: verificar si existen otros comodatos para este producto en otras suscripciones
        const otherComodatos = await this.comodato.findMany({
          where: {
            person_id: subscription.customer_id,
            product_id: planProduct.product_id,
            status: ComodatoStatus.ACTIVE,
            is_active: true,
            subscription_id: { not: subscriptionId },
          },
        });

        if (otherComodatos.length > 0) {
          this.logger.log(
            `ℹ️ Cliente tiene ${otherComodatos.length} comodato(s) activo(s) para producto ${planProduct.product.description} en otras suscripciones. Creando comodato adicional para suscripción ${subscriptionId}`,
          );
        }

        // Calcular fecha esperada de devolución (1 año después)
        const expectedReturnDate = new Date(deliveryDate);
        expectedReturnDate.setFullYear(expectedReturnDate.getFullYear() + 1);

        const comodatoDto: CreateComodatoDto = {
          person_id: subscription.customer_id,
          product_id: planProduct.product_id,
          quantity: planProduct.product_quantity,
          delivery_date: deliveryDate.toISOString().split('T')[0],
          expected_return_date: expectedReturnDate.toISOString().split('T')[0],
          status: ComodatoStatus.ACTIVE,
          notes: `Comodato automático - Primer ciclo de suscripción ${subscriptionId}`,
          article_description: planProduct.product.description,
          deposit_amount: 0, // Sin depósito en primer ciclo
          monthly_fee: 0, // Sin cuota mensual en primer ciclo
        };

        const newComodato = await this.comodato.create({
          data: {
            person_id: comodatoDto.person_id,
            product_id: comodatoDto.product_id,
            subscription_id: subscriptionId, // ← Agregar subscription_id
            quantity: comodatoDto.quantity,
            delivery_date: new Date(comodatoDto.delivery_date),
            expected_return_date: comodatoDto.expected_return_date
              ? new Date(comodatoDto.expected_return_date)
              : null,
            status: comodatoDto.status,
            notes: `${comodatoDto.notes} - Suscripción ID: ${subscriptionId}`,
            deposit_amount: comodatoDto.deposit_amount || null,
            monthly_fee: comodatoDto.monthly_fee || null,
            article_description: comodatoDto.article_description,
            brand: comodatoDto.brand || null,
            model: comodatoDto.model || null,
            contract_image_path: comodatoDto.contract_image_path || null,
            is_active: true,
          },
        });

        comodatosCreated.push({
          comodato_id: newComodato.comodato_id,
          product_id: planProduct.product_id,
          product_description: planProduct.product.description,
          quantity: planProduct.product_quantity,
          delivery_date: deliveryDate.toISOString().split('T')[0],
        });

        this.logger.log(
          `✅ Comodato creado: ${planProduct.product.description} (ID: ${newComodato.comodato_id})`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error creando comodato para producto ${planProduct.product.description}:`,
          error.message,
        );
      }
    }

    this.logger.log(
      `🎉 Proceso completado: ${comodatosCreated.length} comodatos creados para primer ciclo`,
    );

    return {
      comodatos_created: comodatosCreated,
      total_comodatos: comodatosCreated.length,
      is_first_cycle: true,
      customer_id: subscription.customer_id,
      subscription_id: subscriptionId,
    };
  }

  /**
   * Verifica si es el primer ciclo de una suscripción
   */
  private async isFirstCycle(subscriptionId: number): Promise<boolean> {
    const cycleCount = await this.subscription_cycle.count({
      where: { subscription_id: subscriptionId },
    });

    return cycleCount === 1;
  }

  /**
   * Obtiene información de comodatos activos para un cliente
   */
  async getActiveComodatosByCustomer(customerId: number) {
    const comodatos = await this.comodato.findMany({
      where: {
        person_id: customerId,
        status: ComodatoStatus.ACTIVE,
        is_active: true,
      },
      include: {
        product: {
          select: {
            product_id: true,
            description: true,
            is_returnable: true,
          },
        },
      },
      orderBy: {
        delivery_date: 'desc',
      },
    });

    // Mapear los resultados al formato esperado
    const mappedComodatos = await Promise.all(
      comodatos.map(async (comodato) => {
        // Buscar información de suscripción para este comodato
        let subscription = null;
        if (comodato.notes && comodato.notes.includes('suscripción')) {
          // Extraer subscription_id de las notas si está disponible
          const subscriptionMatch = comodato.notes.match(/suscripción (\d+)/);
          if (subscriptionMatch) {
            const subscriptionId = parseInt(subscriptionMatch[1]);
            const subscriptionData = await this.customer_subscription.findUnique({
              where: { subscription_id: subscriptionId },
              include: {
                subscription_plan: {
                  select: {
                    name: true,
                  },
                },
              },
            });
            if (subscriptionData) {
              subscription = {
                subscription_id: subscriptionId,
                subscription_name: subscriptionData.subscription_plan.name,
              };
            }
          }
        }

        return {
          comodato_id: comodato.comodato_id,
          person_id: comodato.person_id,
          product_id: comodato.product_id,
          quantity: comodato.quantity,
          delivery_date: comodato.delivery_date,
          return_date: comodato.return_date,
          expected_return_date: comodato.expected_return_date,
          status: comodato.status,
          notes: comodato.notes,
          deposit_amount: comodato.deposit_amount?.toString() || '0',
          monthly_fee: comodato.monthly_fee?.toString() || '0',
          article_description: comodato.article_description || '',
          brand: comodato.brand || '',
          model: comodato.model || '',
          contract_image_path: comodato.contract_image_path
            ? (() => {
                if (typeof comodato.contract_image_path === 'string' && 
                    !comodato.contract_image_path.includes('[object File]')) {
                  return buildImageUrl(comodato.contract_image_path, 'contracts');
                }
                return null;
              })()
            : null,
          created_at: comodato.created_at,
          updated_at: comodato.updated_at,
          is_active: comodato.is_active,
          product: {
            product_id: comodato.product.product_id,
            description: comodato.product.description,
            is_returnable: comodato.product.is_returnable,
          },
          subscription: subscription,
        };
      })
    );

    return mappedComodatos;
  }

  /**
   * Verifica si un cliente ya tiene comodato activo para un producto específico
   */
  async hasActiveComodatoForProduct(
    customerId: number,
    productId: number,
  ): Promise<boolean> {
    const existingComodato = await this.comodato.findFirst({
      where: {
        person_id: customerId,
        product_id: productId,
        status: ComodatoStatus.ACTIVE,
        is_active: true,
      },
    });

    return !!existingComodato;
  }

  /**
   * Valida que no existan comodatos activos duplicados para la misma suscripción
   * Permite múltiples comodatos del mismo producto si son de suscripciones diferentes
   */
  async validateExistingComodatos(
    customerId: number,
    productIds: number[],
    subscriptionId?: number,
  ): Promise<{
    hasConflicts: boolean;
    conflicts: Array<{
      product_id: number;
      existing_comodato_id: number;
      product_description?: string;
    }>;
  }> {
    this.logger.log(
      `🔍 Validando comodatos existentes para cliente ${customerId}, suscripción ${subscriptionId || 'N/A'} y productos [${productIds.join(', ')}]`,
    );

    const conflicts = [];

    for (const productId of productIds) {
      // Si se proporciona subscriptionId, validar solo para esa suscripción específica
      const whereCondition = subscriptionId 
        ? {
            person_id: customerId,
            product_id: productId,
            subscription_id: subscriptionId,
            status: ComodatoStatus.ACTIVE,
            is_active: true,
          }
        : {
            person_id: customerId,
            product_id: productId,
            status: ComodatoStatus.ACTIVE,
            is_active: true,
          };

      const existingComodato = await this.comodato.findFirst({
        where: whereCondition,
        include: {
          product: {
            select: {
              description: true,
            },
          },
        },
      });

      if (existingComodato) {
        conflicts.push({
          product_id: productId,
          existing_comodato_id: existingComodato.comodato_id,
          product_description: existingComodato.product?.description,
        });

        const subscriptionInfo = subscriptionId ? ` en suscripción ${subscriptionId}` : '';
        this.logger.warn(
          `⚠️ Conflicto detectado: Cliente ${customerId} ya tiene comodato activo (ID: ${existingComodato.comodato_id}) para producto ${productId} (${existingComodato.product?.description})${subscriptionInfo}`,
        );
      }
    }

    const hasConflicts = conflicts.length > 0;

    if (hasConflicts) {
      this.logger.warn(
        `❌ Validación fallida: ${conflicts.length} conflictos encontrados para cliente ${customerId}`,
      );
    } else {
      this.logger.log(
        `✅ Validación exitosa: No hay conflictos para cliente ${customerId}`,
      );
    }

    return {
      hasConflicts,
      conflicts,
    };
  }

  /**
   * Obtiene resumen de comodatos para una suscripción específica
   */
  async getComodatoSummaryBySubscription(subscriptionId: number) {
    const subscription = await this.customer_subscription.findUnique({
      where: { subscription_id: subscriptionId },
      include: {
        person: {
          select: {
            name: true,
            owns_returnable_containers: true,
          },
        },
      },
    });

    if (!subscription) {
      return null;
    }

    const activeComodatos = await this.getActiveComodatosByCustomer(
      subscription.customer_id,
    );
    const isFirstCycle = await this.isFirstCycle(subscriptionId);

    return {
      subscription_id: subscriptionId,
      customer_id: subscription.customer_id,
      customer_name: subscription.person.name,
      is_first_cycle: isFirstCycle,
      active_comodatos: activeComodatos.map((comodato) => ({
        comodato_id: comodato.comodato_id,
        product_id: comodato.product_id,
        product_description: comodato.product.description,
        quantity: comodato.quantity,
        delivery_date: comodato.delivery_date.toISOString().split('T')[0],
        expected_return_date:
          comodato.expected_return_date?.toISOString().split('T')[0] || null,
        notes: comodato.notes,
      })),
      total_active_comodatos: activeComodatos.length,
    };
  }
}
