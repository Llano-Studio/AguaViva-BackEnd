import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma, SubscriptionStatus } from '@prisma/client';
import {
  CreateCustomerSubscriptionDto,
  UpdateCustomerSubscriptionDto,
  FilterCustomerSubscriptionsDto,
  CustomerSubscriptionResponseDto,
  PaginatedCustomerSubscriptionResponseDto,
  CreateSubscriptionDeliveryScheduleDto,
  UpdateSubscriptionDeliveryScheduleDto,
  SubscriptionDeliveryScheduleResponseDto,
} from './dto';
import { FirstCycleComodatoService } from '../orders/services/first-cycle-comodato.service';
import { CycleNumberingService } from './services/cycle-numbering.service';
import { SubscriptionCycleCalculatorService } from './services/subscription-cycle-calculator.service';
import { RecoveryOrderService } from '../services/recovery-order.service';

@Injectable()
export class CustomerSubscriptionService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly logger = new Logger(CustomerSubscriptionService.name);

  constructor(
    private readonly firstCycleComodatoService: FirstCycleComodatoService,
    private readonly cycleNumberingService: CycleNumberingService,
    private readonly subscriptionCycleCalculatorService: SubscriptionCycleCalculatorService,
    private readonly recoveryOrderService: RecoveryOrderService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  private parseDeliveryPreferences(notes?: string | null) {
    if (!notes) return undefined;

    try {
      const parsed = JSON.parse(notes);
      // Solo retornar delivery_preferences si existe en la estructura
      return parsed.delivery_preferences || undefined;
    } catch {
      // Si no es JSON válido, asumimos que son solo notas de texto
      return undefined;
    }
  }

  private parseClientNotes(notes?: string | null): string | null {
    if (!notes) return null;

    try {
      const parsed = JSON.parse(notes);

      // Si hay notas del cliente, las retornamos
      if (parsed.client_notes && typeof parsed.client_notes === 'string') {
        return parsed.client_notes.trim() || null;
      }

      // Si hay notas originales del formato anterior
      if (parsed.original_notes && typeof parsed.original_notes === 'string') {
        return parsed.original_notes.trim() || null;
      }

      // Si es un JSON pero no tiene notas del cliente, retornar null (campo vacío)
      return null;
    } catch {
      // Si no es JSON válido, es una nota de texto simple del cliente
      return notes.trim() || null;
    }
  }

  private buildNotesWithPreferences(
    clientNotes?: string | null,
    newPreferences?: any,
  ): string | null {
    // Si no hay notas del cliente ni preferencias, retornar null
    if ((!clientNotes || clientNotes.trim() === '') && !newPreferences)
      return null;

    const notesObject: any = {};

    // Agregar notas del cliente si existen y no están vacías
    if (clientNotes && clientNotes.trim() !== '') {
      notesObject.client_notes = clientNotes.trim();
    }

    // Agregar delivery preferences si existen
    if (newPreferences) {
      notesObject.delivery_preferences = newPreferences;
    }

    // Si el objeto está vacío, retornar null
    if (Object.keys(notesObject).length === 0) {
      return null;
    }

    return JSON.stringify(notesObject);
  }

  async create(
    createDto: CreateCustomerSubscriptionDto,
  ): Promise<CustomerSubscriptionResponseDto> {
    this.logger.log(
      `Creating subscription for customer: ${createDto.customer_id}`,
    );

    // Verificar que el cliente existe
    const customer = await this.person.findUnique({
      where: { person_id: createDto.customer_id },
    });

    if (!customer) {
      throw new NotFoundException(
        `Cliente con ID ${createDto.customer_id} no encontrado`,
      );
    }

    // Verificar que el plan de suscripción existe
    const subscriptionPlan = await this.subscription_plan.findUnique({
      where: { subscription_plan_id: createDto.subscription_plan_id },
    });

    if (!subscriptionPlan) {
      throw new NotFoundException(
        `Plan de suscripción con ID ${createDto.subscription_plan_id} no encontrado`,
      );
    }

    // CORRECCIÓN: Si el plan tiene tipo "INDIVIDUAL", cambiarlo automáticamente a "PLAN"
    if (subscriptionPlan.type === 'INDIVIDUAL') {
      await this.subscription_plan.update({
        where: { subscription_plan_id: createDto.subscription_plan_id },
        data: { type: 'PLAN' },
      });
      this.logger.log(
        `Plan de suscripción "${subscriptionPlan.name}" (ID: ${subscriptionPlan.subscription_plan_id}) actualizado de tipo "INDIVIDUAL" a "PLAN"`,
      );
    }

    // CORRECCIÓN: Validar que el plan tenga precio definido
    if (!subscriptionPlan.price || Number(subscriptionPlan.price) <= 0) {
      throw new BadRequestException(
        `No se puede crear la suscripción: El plan "${subscriptionPlan.name}" (ID: ${subscriptionPlan.subscription_plan_id}) no tiene precio definido. ` +
        `Debe asignar un precio al plan antes de crear suscripciones.`
      );
    }

    // Nota: Se permite múltiples suscripciones del mismo plan para un cliente
    // El sistema está diseñado para manejar múltiples suscripciones activas
    // como evidencia el módulo MultipleSubscriptionsModule y sus estadísticas

    // Build notes with delivery preferences separados
    const notes = this.buildNotesWithPreferences(
      createDto.notes,
      createDto.delivery_preferences,
    );

    try {
      const subscription = await this.customer_subscription.create({
        data: {
          customer_id: createDto.customer_id,
          subscription_plan_id: createDto.subscription_plan_id,
          start_date: new Date(createDto.start_date),
          // end_date field removed - not present in schema
          collection_day: createDto.collection_day || null,
          status: createDto.status || SubscriptionStatus.ACTIVE,
          notes,
        },
        include: {
          subscription_plan: {
            include: {
              subscription_plan_product: true,
            },
          },
        },
      });

      // Crear el primer ciclo de suscripción usando la nueva lógica de collection_day
      const cycleDates = this.calculateCycleDates(
        new Date(createDto.start_date),
        createDto.collection_day || 0,
        true // isNewSubscription = true para crear ciclo inmediato
      );
      
      const firstCycleStartDate = cycleDates.cycle_start;
      const firstCycleEndDate = cycleDates.cycle_end;

      // Calcular fecha de vencimiento de pago (10 días después del final del ciclo)
      const paymentDueDate = new Date(firstCycleEndDate);
      paymentDueDate.setDate(paymentDueDate.getDate() + 10);

      const firstCycle = await this.cycleNumberingService.createCycleWithNumber(
        subscription.subscription_id,
        {
          cycle_start: firstCycleStartDate,
          cycle_end: firstCycleEndDate,
          payment_due_date: paymentDueDate,
          total_amount: 0, // Se calculará después
        },
      );

      // Crear los detalles del ciclo con las cantidades planificadas del plan
      for (const planProduct of subscription.subscription_plan
        .subscription_plan_product) {
        await this.subscription_cycle_detail.create({
          data: {
            cycle_id: firstCycle.cycle_id,
            product_id: planProduct.product_id,
            planned_quantity: planProduct.product_quantity,
            delivered_quantity: 0,
            remaining_balance: planProduct.product_quantity,
          },
        });
      }

      // Calcular el total_amount del ciclo basado en los productos del plan
      try {
        await this.subscriptionCycleCalculatorService.calculateAndUpdateCycleAmount(firstCycle.cycle_id);
        this.logger.log(
          `✅ Total amount calculated for cycle ${firstCycle.cycle_id} of subscription ${subscription.subscription_id}`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Error calculating total amount for cycle ${firstCycle.cycle_id}:`,
          error,
        );
        // No fallar la creación de la suscripción por errores en el cálculo
      }

      this.logger.log(
        `Created first cycle for subscription ${subscription.subscription_id} from ${firstCycleStartDate.toISOString().split('T')[0]} to ${firstCycleEndDate.toISOString().split('T')[0]}`,
      );

      // Procesar comodatos automáticos para el primer ciclo
      try {
        const comodatoResult =
          await this.firstCycleComodatoService.processFirstCycleComodato(
            subscription.subscription_id,
            firstCycleStartDate,
          );

        if (comodatoResult.comodatos_created.length > 0) {
          this.logger.log(
            `✅ Comodatos automáticos creados para suscripción ${subscription.subscription_id}: ` +
              `${comodatoResult.total_comodatos} comodatos para productos retornables`,
          );
        } else {
          this.logger.log(
            `ℹ️ No se crearon comodatos para suscripción ${subscription.subscription_id}: ` +
              `no hay productos retornables en el plan o ya existen comodatos activos`,
          );
        }
      } catch (error) {
        this.logger.error(
          `❌ Error procesando comodatos automáticos para suscripción ${subscription.subscription_id}:`,
          error,
        );
        // No fallar la creación de la suscripción por errores en comodatos
      }

      // Crear horarios de entrega según delivery_preferences
      if (
        createDto.delivery_preferences?.preferred_days &&
        createDto.delivery_preferences.preferred_time_range
      ) {
        const dayNameToNumber: Record<string, number> = {
          MONDAY: 1,
          TUESDAY: 2,
          WEDNESDAY: 3,
          THURSDAY: 4,
          FRIDAY: 5,
          SATURDAY: 6,
          SUNDAY: 7,
        };
        for (const dayName of createDto.delivery_preferences.preferred_days) {
          const dayOfWeek = dayNameToNumber[dayName.toUpperCase()];
          if (dayOfWeek) {
            await this.subscription_delivery_schedule.create({
              data: {
                subscription_id: subscription.subscription_id,
                day_of_week: dayOfWeek,
                scheduled_time:
                  createDto.delivery_preferences.preferred_time_range,
              },
            });
          }
        }
      }

      const response = new CustomerSubscriptionResponseDto(subscription);
      response.delivery_preferences = this.parseDeliveryPreferences(
        subscription.notes,
      );

      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException(
            'Ya existe una suscripción con estos datos',
          );
        }
      }
      throw error;
    }
  }

  async findAll(
    filters: FilterCustomerSubscriptionsDto,
  ): Promise<PaginatedCustomerSubscriptionResponseDto> {
    this.logger.log(
      `Finding subscriptions with filters: ${JSON.stringify(filters)}`,
    );

    const {
      page = 1,
      limit = 10,
      sortBy = 'subscription_id',
      ...filterParams
    } = filters;

    const skip = (page - 1) * limit;

    // Construir filtros dinámicos
    const where = this.buildWhereClause(filterParams);

    // Construir ordenamiento dinámico
    const orderBy = this.buildOrderByClause(sortBy, 'asc');

    const [subscriptions, total] = await Promise.all([
      this.customer_subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.getIncludeClause(),
      }),
      this.customer_subscription.count({ where }),
    ]);

    const mappedSubscriptions = subscriptions.map((subscription) => {
      const response = this.mapToResponseDto(subscription);
      response.delivery_preferences = this.parseDeliveryPreferences(
        subscription.notes,
      );
      return response;
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: mappedSubscriptions,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async findOne(id: number, includeInactive: boolean = false): Promise<CustomerSubscriptionResponseDto> {
    this.logger.log(`Finding subscription: ${id}`);

    const subscription = await this.customer_subscription.findFirst({
      where: { 
        subscription_id: id,
        ...(includeInactive ? {} : { is_active: true })
      },
      include: this.getIncludeClause(),
    });

    if (!subscription) {
      throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
    }

    const response = this.mapToResponseDto(subscription);
    response.delivery_preferences = this.parseDeliveryPreferences(
      subscription.notes,
    );

    return response;
  }

  async update(
    id: number,
    updateDto: UpdateCustomerSubscriptionDto,
  ): Promise<CustomerSubscriptionResponseDto> {
    this.logger.log(`Updating subscription: ${id}`);

    // Verificar que la suscripción existe
    const existingSubscription = await this.customer_subscription.findUnique({
      where: { subscription_id: id },
    });

    if (!existingSubscription) {
      throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
    }

    // Verificar que el nuevo plan existe si se está actualizando
    if (updateDto.subscription_plan_id) {
      const planExists = await this.subscription_plan.findUnique({
        where: { subscription_plan_id: updateDto.subscription_plan_id },
      });

      if (!planExists) {
        throw new NotFoundException(
          `Plan de suscripción con ID ${updateDto.subscription_plan_id} no encontrado`,
        );
      }
    }

    // Build notes with delivery preferences, manteniendo notas del cliente existentes si no se proveen nuevas
    const currentClientNotes = this.parseClientNotes(
      existingSubscription.notes,
    );
    const finalClientNotes =
      updateDto.notes !== undefined ? updateDto.notes : currentClientNotes;
    const notes = this.buildNotesWithPreferences(
      finalClientNotes,
      updateDto.delivery_preferences,
    );

    try {
      const updateData: any = {};

      if (updateDto.subscription_plan_id !== undefined) {
        updateData.subscription_plan_id = updateDto.subscription_plan_id;
      }
      // end_date field removed - not present in schema
      if (updateDto.collection_day !== undefined) {
        updateData.collection_day = updateDto.collection_day;
      }
      if (updateDto.status !== undefined) {
        updateData.status = updateDto.status;
      }
      if (
        updateDto.notes !== undefined ||
        updateDto.delivery_preferences !== undefined
      ) {
        updateData.notes = notes;
      }

      const subscription = await this.customer_subscription.update({
        where: { subscription_id: id },
        data: updateData,
        include: {
          subscription_plan: {
            select: {
              name: true,
              description: true,
              price: true,
            },
          },
        },
      });

      const response = new CustomerSubscriptionResponseDto(subscription);
      response.delivery_preferences = this.parseDeliveryPreferences(
        subscription.notes,
      );

      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
        }
        throw new BadRequestException(
          `Error al actualizar la suscripción: ${error.message}`,
        );
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    this.logger.log(`Removing subscription: ${id}`);

    const subscription = await this.customer_subscription.findUnique({
      where: { subscription_id: id },
      include: {
        order_header: true,
        subscription_cycle: true,
        subscription_delivery_schedule: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
    }

    // Verificar si hay órdenes asociadas - no permitir eliminar si existen
    if (subscription.order_header && subscription.order_header.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar la suscripción porque tiene ${subscription.order_header.length} orden(es) asociada(s). Debe cancelar primero las órdenes relacionadas.`,
      );
    }

    try {
      // Usar transacción para asegurar consistencia
      await this.$transaction(async (prisma) => {
        // 1. Eliminar los horarios de entrega
        if (
          subscription.subscription_delivery_schedule &&
          subscription.subscription_delivery_schedule.length > 0
        ) {
          await prisma.subscription_delivery_schedule.deleteMany({
            where: { subscription_id: id },
          });
          this.logger.log(
            `Deleted ${subscription.subscription_delivery_schedule.length} delivery schedule(s) for subscription ${id}`,
          );
        }

        // 2. Eliminar los detalles de ciclos primero
        for (const cycle of subscription.subscription_cycle || []) {
          await prisma.subscription_cycle_detail.deleteMany({
            where: { cycle_id: cycle.cycle_id },
          });
        }

        // 3. Eliminar los ciclos de suscripción
        if (
          subscription.subscription_cycle &&
          subscription.subscription_cycle.length > 0
        ) {
          await prisma.subscription_cycle.deleteMany({
            where: { subscription_id: id },
          });
          this.logger.log(
            `Deleted ${subscription.subscription_cycle.length} subscription cycle(s) for subscription ${id}`,
          );
        }

        // 4. Soft delete: cambiar is_active a false en lugar de eliminar físicamente
        await prisma.customer_subscription.update({
          where: { subscription_id: id },
          data: { is_active: false }
        });

        this.logger.log(`Successfully deactivated subscription ${id}`);
      });
    } catch (error) {
      this.logger.error(`Error deleting subscription ${id}:`, error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new BadRequestException(
            'No se puede eliminar la suscripción debido a restricciones de integridad de datos. Verifique que no existan registros relacionados.',
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
        }
      }
      throw new BadRequestException(
        `Error al eliminar la suscripción: ${error.message}`,
      );
    }
  }

  private getIncludeClause() {
    return {
      person: {
        include: {
          zone: {
            include: {
              locality: true,
            },
          },
        },
      },
      subscription_plan: true,
      subscription_cycle: {
        orderBy: { cycle_start: 'desc' as const },
        take: 5,
        include: {
          subscription_cycle_detail: {
            include: {
              product: {
                select: {
                  product_id: true,
                  description: true,
                  price: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: { order_header: true },
      },
    };
  }

  private buildWhereClause(
    filters: Partial<FilterCustomerSubscriptionsDto>,
  ): Prisma.customer_subscriptionWhereInput {
    const where: Prisma.customer_subscriptionWhereInput = {
      is_active: true, // Solo mostrar suscripciones activas
    };

    // Manejar filtrado por IDs de clientes (múltiples o único)
    if (filters.customer_ids && filters.customer_ids.length > 0) {
      // Si se proporcionan múltiples IDs de clientes, usar operador IN
      where.customer_id = { in: filters.customer_ids };
    } else if (filters.customer_id) {
      // Si solo se proporciona un ID de cliente (compatibilidad), usar equality
      where.customer_id = filters.customer_id;
    }

    // Manejar filtrado por IDs de planes de suscripción (múltiples o único)
    if (
      filters.subscription_plan_ids &&
      filters.subscription_plan_ids.length > 0
    ) {
      // Si se proporcionan múltiples IDs de planes, usar operador IN
      where.subscription_plan_id = { in: filters.subscription_plan_ids };
    } else if (filters.subscription_plan_id) {
      // Si solo se proporciona un ID de plan (compatibilidad), usar equality
      where.subscription_plan_id = filters.subscription_plan_id;
    }

    // Manejar filtrado por estados (múltiples o único)
    if (filters.statuses && filters.statuses.length > 0) {
      // Si se proporcionan múltiples estados, usar operador IN
      where.status = { in: filters.statuses };
    } else if (filters.status) {
      // Si solo se proporciona un estado (compatibilidad), usar equality
      where.status = filters.status;
    }

    if (filters.start_date_from || filters.start_date_to) {
      where.start_date = {};
      if (filters.start_date_from) {
        const fromDate = new Date(filters.start_date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.start_date.gte = fromDate;
      }
      if (filters.start_date_to) {
        const toDate = new Date(filters.start_date_to);
        toDate.setHours(23, 59, 59, 999);
        where.start_date.lte = toDate;
      }
    }

    // end_date filtering removed - field not present in schema

    if (filters.search) {
      where.OR = [
        {
          notes: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (filters.only_active) {
      where.AND = [
        {
          OR: [
            { status: SubscriptionStatus.ACTIVE },
            { status: SubscriptionStatus.PAUSED },
          ],
        },
        {
          OR: [
            // end_date conditions removed - field not present in schema
          ],
        },
      ];
    }

    return where;
  }

  private buildOrderByClause(
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Prisma.customer_subscriptionOrderByWithRelationInput {
    const orderBy: Prisma.customer_subscriptionOrderByWithRelationInput = {};

    switch (sortBy) {
      case 'start_date':
        orderBy.start_date = sortOrder;
        break;
      // end_date sorting removed - field not present in schema
      case 'status':
        orderBy.status = sortOrder;
        break;
      default:
        orderBy.subscription_id = sortOrder;
    }

    return orderBy;
  }

  private mapToResponseDto(subscription: any): CustomerSubscriptionResponseDto {
    return new CustomerSubscriptionResponseDto({
      subscription_id: subscription.subscription_id,
      customer_id: subscription.customer_id,
      subscription_plan_id: subscription.subscription_plan_id,
      start_date: subscription.start_date.toISOString().split('T')[0],
      // end_date removed - field not present in schema
      collection_day: subscription.collection_day,
      status: subscription.status,
      notes: this.parseClientNotes(subscription.notes),
      customer: {
        person_id: subscription.person?.person_id || subscription.customer_id,
        name: subscription.person?.name || 'Cliente',
        phone: subscription.person?.phone || '',
        address: subscription.person?.address || '',
        zone: subscription.person?.zone
          ? {
              zone_id: subscription.person.zone.zone_id,
              name: subscription.person.zone.name,
              locality: {
                locality_id: subscription.person.zone.locality.locality_id,
                name: subscription.person.zone.locality.name,
              },
            }
          : undefined,
      },
      subscription_plan: {
        subscription_plan_id:
          subscription.subscription_plan.subscription_plan_id,
        name: subscription.subscription_plan.name,
        description: subscription.subscription_plan.description,
        price: subscription.subscription_plan.price?.toString(),
      },
      subscription_cycle: subscription.subscription_cycle?.map(
        (cycle: any) => ({
          cycle_id: cycle.cycle_id,
          cycle_start: cycle.cycle_start.toISOString().split('T')[0],
          cycle_end: cycle.cycle_end.toISOString().split('T')[0],
          notes: cycle.notes,
          subscription_cycle_detail:
            cycle.subscription_cycle_detail?.map((detail: any) => ({
              cycle_detail_id: detail.cycle_detail_id,
              product_id: detail.product_id,
              planned_quantity: detail.planned_quantity,
              delivered_quantity: detail.delivered_quantity,
              remaining_balance: detail.remaining_balance,
              product: detail.product
                ? {
                    product_id: detail.product.product_id,
                    description: detail.product.description,
                    price: detail.product.price
                      ? parseFloat(detail.product.price.toString())
                      : undefined,
                  }
                : undefined,
            })) || [],
        }),
      ),
      orders_count: subscription._count?.order_header || 0,
    });
  }

  // =============================================================================
  // MÉTODOS PARA HORARIOS DE ENTREGA
  // =============================================================================

  /**
   * Valida si un horario está en formato correcto
   * Soporta: HH:MM (puntual) o HH:MM-HH:MM (rango)
   */
  private validateScheduledTime(scheduledTime: string): {
    isValid: boolean;
    type: 'puntual' | 'rango';
    startTime?: string;
    endTime?: string;
    error?: string;
  } {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

    if (scheduledTime.includes('-')) {
      // Formato de rango: HH:MM-HH:MM
      const [startTime, endTime] = scheduledTime
        .split('-')
        .map((t) => t.trim());

      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return {
          isValid: false,
          type: 'rango',
          error: 'Formato inválido para rango horario. Use HH:MM-HH:MM',
        };
      }

      // Verificar que la hora de inicio sea menor que la de fin
      const startMinutes = this.timeToMinutes(startTime);
      const endMinutes = this.timeToMinutes(endTime);

      if (startMinutes >= endMinutes) {
        return {
          isValid: false,
          type: 'rango',
          error: 'La hora de inicio debe ser menor que la hora de fin',
        };
      }

      return { isValid: true, type: 'rango', startTime, endTime };
    } else {
      // Formato puntual: HH:MM
      if (!timeRegex.test(scheduledTime)) {
        return {
          isValid: false,
          type: 'puntual',
          error: 'Formato inválido para horario puntual. Use HH:MM',
        };
      }

      return { isValid: true, type: 'puntual', startTime: scheduledTime };
    }
  }

  /**
   * Convierte un tiempo en formato HH:MM a minutos desde medianoche
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Calcula las fechas de inicio y fin del ciclo basándose en el collection_day
   * @param startDate Fecha de inicio de la suscripción
   * @param collectionDay Día del mes para recolección (1-28)
   * @param isNewSubscription Si es una suscripción nueva (para crear ciclo inmediato)
   * @returns Objeto con cycle_start y cycle_end
   */
  private calculateCycleDates(
    startDate: Date, 
    collectionDay: number, 
    isNewSubscription: boolean = false
  ): { cycle_start: Date; cycle_end: Date } {
    const today = new Date();
    const subscriptionStart = new Date(startDate);
    
    // Si no hay collection_day, usar la fecha de inicio como base
    if (!collectionDay) {
      const cycleStart = new Date(Math.max(today.getTime(), subscriptionStart.getTime()));
      const cycleEnd = new Date(cycleStart);
      cycleEnd.setMonth(cycleEnd.getMonth() + 1);
      return { cycle_start: cycleStart, cycle_end: cycleEnd };
    }

    // LÓGICA ESPECIAL PARA SUSCRIPCIONES NUEVAS
    if (isNewSubscription) {
      // Para suscripciones nuevas, siempre crear un ciclo que comience inmediatamente
      const cycleStart = new Date(Math.max(today.getTime(), subscriptionStart.getTime()));
      
      // Calcular la fecha de fin basada en collection_day
      let cycleEnd: Date;
      
      // Si el collection_day es mayor al día actual, usar este mes
      if (collectionDay > today.getDate()) {
        cycleEnd = new Date(today.getFullYear(), today.getMonth(), collectionDay);
      } else {
        // Si el collection_day ya pasó este mes, usar el próximo mes
        cycleEnd = new Date(today.getFullYear(), today.getMonth() + 1, collectionDay);
      }
      
      // Asegurar que el ciclo tenga al menos 7 días de duración
      const minCycleEnd = new Date(cycleStart);
      minCycleEnd.setDate(minCycleEnd.getDate() + 7);
      
      if (cycleEnd < minCycleEnd) {
        cycleEnd = new Date(today.getFullYear(), today.getMonth() + 1, collectionDay);
      }
      
      return { cycle_start: cycleStart, cycle_end: cycleEnd };
    }

    // LÓGICA PARA CICLOS REGULARES (renovaciones)
    let cycleStart: Date;
    
    // Si hoy es el día de recolección o después, el ciclo actual ya comenzó
    if (today.getDate() >= collectionDay) {
      // El ciclo actual va del collection_day de este mes al collection_day del próximo mes
      cycleStart = new Date(today.getFullYear(), today.getMonth(), collectionDay);
    } else {
      // El ciclo actual va del collection_day del mes pasado al collection_day de este mes
      cycleStart = new Date(today.getFullYear(), today.getMonth() - 1, collectionDay);
    }

    // Asegurar que no sea anterior a la fecha de inicio de la suscripción
    if (cycleStart < subscriptionStart) {
      cycleStart = new Date(subscriptionStart.getFullYear(), subscriptionStart.getMonth(), collectionDay);
      
      // Si el collection_day ya pasó en el mes de inicio, mover al siguiente mes
      if (cycleStart < subscriptionStart) {
        cycleStart.setMonth(cycleStart.getMonth() + 1);
      }
    }

    // Calcular fecha de fin del ciclo (collection_day del siguiente mes)
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setMonth(cycleEnd.getMonth() + 1);

    return { cycle_start: cycleStart, cycle_end: cycleEnd };
  }

  /**
   * Normaliza scheduled_time a string para retrocompatibilidad
   */
  private normalizeScheduledTime(scheduledTime: string | Date): string {
    if (typeof scheduledTime === 'string') {
      return scheduledTime;
    }
    // Si es Date (formato legacy), convertir a HH:MM
    return scheduledTime.toTimeString().split(' ')[0].substring(0, 5);
  }

  /**
   * Verifica si dos horarios se superponen
   */
  private checkTimeOverlap(schedule1: string, schedule2: string): boolean {
    const parsed1 = this.validateScheduledTime(schedule1);
    const parsed2 = this.validateScheduledTime(schedule2);

    if (!parsed1.isValid || !parsed2.isValid) {
      return false;
    }

    // Convertir ambos horarios a rangos para facilitar la comparación
    const range1 = {
      start: this.timeToMinutes(parsed1.startTime),
      end:
        parsed1.type === 'rango'
          ? this.timeToMinutes(parsed1.endTime)
          : this.timeToMinutes(parsed1.startTime) + 30, // 30 min para puntuales
    };

    const range2 = {
      start: this.timeToMinutes(parsed2.startTime),
      end:
        parsed2.type === 'rango'
          ? this.timeToMinutes(parsed2.endTime)
          : this.timeToMinutes(parsed2.startTime) + 30, // 30 min para puntuales
    };

    // Verificar superposición
    return range1.start < range2.end && range2.start < range1.end;
  }

  async createDeliverySchedule(
    createDto: CreateSubscriptionDeliveryScheduleDto,
  ): Promise<SubscriptionDeliveryScheduleResponseDto> {
    this.logger.log(
      `Creating delivery schedule for subscription: ${createDto.subscription_id}`,
    );

    // Validar formato del horario
    const timeValidation = this.validateScheduledTime(createDto.scheduled_time);
    if (!timeValidation.isValid) {
      throw new BadRequestException(timeValidation.error);
    }

    // Verificar que la suscripción existe
    const subscription = await this.customer_subscription.findUnique({
      where: { subscription_id: createDto.subscription_id },
    });

    if (!subscription) {
      throw new NotFoundException(
        `Suscripción con ID ${createDto.subscription_id} no encontrada`,
      );
    }

    // Verificar que no haya horarios que se superpongan en el mismo día
    const existingSchedules =
      await this.subscription_delivery_schedule.findMany({
        where: {
          subscription_id: createDto.subscription_id,
          day_of_week: createDto.day_of_week,
        },
      });

    for (const existingSchedule of existingSchedules) {
      const normalizedExistingTime = this.normalizeScheduledTime(
        existingSchedule.scheduled_time,
      );
      if (
        this.checkTimeOverlap(createDto.scheduled_time, normalizedExistingTime)
      ) {
        throw new BadRequestException(
          `El horario ${createDto.scheduled_time} se superpone con el horario existente ${normalizedExistingTime} para el día ${createDto.day_of_week}`,
        );
      }
    }

    const schedule = await this.subscription_delivery_schedule.create({
      data: {
        subscription_id: createDto.subscription_id,
        day_of_week: createDto.day_of_week,
        scheduled_time: createDto.scheduled_time,
      },
    });

    return new SubscriptionDeliveryScheduleResponseDto(schedule);
  }

  async findDeliverySchedulesBySubscription(
    subscriptionId: number,
  ): Promise<SubscriptionDeliveryScheduleResponseDto[]> {
    this.logger.log(
      `Finding delivery schedules for subscription: ${subscriptionId}`,
    );

    const schedules = await this.subscription_delivery_schedule.findMany({
      where: { subscription_id: subscriptionId },
      orderBy: { day_of_week: 'asc' },
    });

    return schedules.map(
      (schedule) => new SubscriptionDeliveryScheduleResponseDto(schedule),
    );
  }

  async updateDeliverySchedule(
    scheduleId: number,
    updateDto: UpdateSubscriptionDeliveryScheduleDto,
  ): Promise<SubscriptionDeliveryScheduleResponseDto> {
    this.logger.log(`Updating delivery schedule: ${scheduleId}`);

    const existingSchedule =
      await this.subscription_delivery_schedule.findUnique({
        where: { schedule_id: scheduleId },
      });

    if (!existingSchedule) {
      throw new NotFoundException(
        `Horario de entrega con ID ${scheduleId} no encontrado`,
      );
    }

    // Validar formato del horario si se está actualizando
    if (updateDto.scheduled_time) {
      const timeValidation = this.validateScheduledTime(
        updateDto.scheduled_time,
      );
      if (!timeValidation.isValid) {
        throw new BadRequestException(timeValidation.error);
      }
    }

    const targetDayOfWeek =
      updateDto.day_of_week ?? existingSchedule.day_of_week;
    const targetScheduledTime =
      updateDto.scheduled_time ??
      this.normalizeScheduledTime(existingSchedule.scheduled_time);

    // Verificar que no haya horarios que se superpongan en el día (si se cambia día o hora)
    if (updateDto.day_of_week || updateDto.scheduled_time) {
      const conflictingSchedules =
        await this.subscription_delivery_schedule.findMany({
          where: {
            subscription_id: existingSchedule.subscription_id,
            day_of_week: targetDayOfWeek,
            schedule_id: { not: scheduleId },
          },
        });

      for (const conflictingSchedule of conflictingSchedules) {
        const conflictingTime = this.normalizeScheduledTime(
          conflictingSchedule.scheduled_time,
        );

        if (this.checkTimeOverlap(targetScheduledTime, conflictingTime)) {
          throw new BadRequestException(
            `El horario ${targetScheduledTime} se superpone con el horario existente ${conflictingTime} para el día ${targetDayOfWeek}`,
          );
        }
      }
    }

    const updatedSchedule = await this.subscription_delivery_schedule.update({
      where: { schedule_id: scheduleId },
      data: {
        ...(updateDto.day_of_week && { day_of_week: updateDto.day_of_week }),
        ...(updateDto.scheduled_time && {
          scheduled_time: updateDto.scheduled_time,
        }),
      },
    });

    return new SubscriptionDeliveryScheduleResponseDto(updatedSchedule);
  }

  async deleteDeliverySchedule(scheduleId: number): Promise<void> {
    this.logger.log(`Deleting delivery schedule: ${scheduleId}`);

    const existingSchedule =
      await this.subscription_delivery_schedule.findUnique({
        where: { schedule_id: scheduleId },
      });

    if (!existingSchedule) {
      throw new NotFoundException(
        `Horario de entrega con ID ${scheduleId} no encontrado`,
      );
    }

    await this.subscription_delivery_schedule.delete({
      where: { schedule_id: scheduleId },
    });
  }

  async findDeliverySchedulesByDay(
    dayOfWeek: number,
  ): Promise<SubscriptionDeliveryScheduleResponseDto[]> {
    this.logger.log(`Finding delivery schedules for day: ${dayOfWeek}`);

    const schedules = await this.subscription_delivery_schedule.findMany({
      where: { day_of_week: dayOfWeek },
      include: {
        customer_subscription: {
          include: {
            subscription_plan: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { scheduled_time: 'asc' },
    });

    return schedules.map(
      (schedule) => new SubscriptionDeliveryScheduleResponseDto(schedule),
    );
  }

  /**
   * Cancela una suscripción y genera órdenes de recuperación para comodatos activos
   * @param subscriptionId ID de la suscripción a cancelar
   * @param customerId ID del cliente (para validación)
   * @param cancellationReason Motivo de la cancelación
   * @returns Suscripción actualizada
   */
  async cancelSubscription(
    subscriptionId: number,
    customerId: number,
    cancellationReason?: string,
  ): Promise<CustomerSubscriptionResponseDto> {
    this.logger.log(`Cancelling subscription: ${subscriptionId}`);

    return this.$transaction(async (prisma) => {
      // Verificar que la suscripción existe y pertenece al cliente
      const subscription = await prisma.customer_subscription.findUnique({
        where: { subscription_id: subscriptionId },
        include: {
          subscription_cycle: {
            orderBy: { cycle_end: 'desc' },
            take: 1,
          },
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
        throw new NotFoundException(
          `Suscripción con ID ${subscriptionId} no encontrada`,
        );
      }

      if (subscription.customer_id !== customerId) {
        throw new BadRequestException(
          'No tienes permiso para cancelar esta suscripción',
        );
      }

      if (subscription.status === SubscriptionStatus.CANCELLED) {
        throw new BadRequestException('La suscripción ya está cancelada');
      }

      if (subscription.status === SubscriptionStatus.EXPIRED) {
        throw new BadRequestException('La suscripción ya está expirada');
      }

      // Calcular fecha efectiva de cancelación
      let effectiveEndDate =
        subscription.subscription_cycle?.[0]?.cycle_end || new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (effectiveEndDate < today) effectiveEndDate = today;

      // Actualizar estado de la suscripción
      const updatedSubscription = await prisma.customer_subscription.update({
        where: { subscription_id: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancellation_date: effectiveEndDate,
          cancellation_reason: cancellationReason,
        },
        include: this.getIncludeClause(),
      });

      // Cancelar órdenes futuras
      await prisma.order_header.updateMany({
        where: {
          subscription_id: subscriptionId,
          scheduled_delivery_date: { gt: effectiveEndDate },
          status: {
            in: ['PENDING', 'CONFIRMED', 'IN_PREPARATION', 'READY_FOR_DELIVERY', 'IN_DELIVERY'],
          },
        },
        data: {
          status: 'CANCELLED',
        },
      });

      // Obtener comodatos activos asociados a la suscripción
      // Buscar por subscription_id Y person_id para asegurar que se encuentren todos los comodatos
      const activeComodatos = await prisma.comodato.findMany({
        where: {
          person_id: customerId,
          subscription_id: subscriptionId,
          status: 'ACTIVE',
        },
        include: {
          product: true,
        },
      });

      // Generar órdenes de recuperación y órdenes de retiro para cada comodato activo
      if (activeComodatos.length > 0) {
        this.logger.log(
          `Generando ${activeComodatos.length} órdenes de recuperación y retiro para suscripción ${subscriptionId}`,
        );

        for (const comodato of activeComodatos) {
          try {
            // 1. Crear orden de recuperación (como antes)
            await this.recoveryOrderService.createRecoveryOrder(
              comodato.comodato_id,
              undefined, // Usar fecha por defecto (7 días)
              `Recuperación automática por cancelación de suscripción ${subscriptionId}`,
            );

            // 2. CORRECCIÓN: Crear Order normal con pedido de retiro de comodato
            const withdrawalOrder = await prisma.order_header.create({
              data: {
                customer_id: customerId,
                sale_channel_id: 1, // Canal por defecto
                order_date: new Date(),
                scheduled_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días desde hoy
                total_amount: 0, // Sin costo para retiro
                paid_amount: 0, // Sin pago para retiro
                order_type: 'ONE_OFF', // Tipo de orden única
                status: 'PENDING', // Estado pendiente
                notes: `Pedido de retiro de comodato ${comodato.comodato_id} - Producto: ${comodato.product.description} (Cantidad: ${comodato.quantity}) - Generado por cancelación de suscripción ${subscriptionId}`,
                subscription_id: subscriptionId, // Asociar con la suscripción cancelada
                // Crear item de orden para el retiro
                order_item: {
                  create: {
                    product_id: comodato.product_id,
                    quantity: comodato.quantity,
                    unit_price: 0, // Sin precio para retiro
                    subtotal: 0, // Sin subtotal para retiro
                    notes: `Retiro de comodato ${comodato.comodato_id} - ${comodato.product.description}`,
                  },
                },
              },
            });

            this.logger.log(
              `Order de retiro creada exitosamente para comodato ${comodato.comodato_id} - Order ID: ${withdrawalOrder.order_id}`,
            );
          } catch (error) {
            this.logger.error(
              `Error generando órdenes para comodato ${comodato.comodato_id}:`,
              error,
            );
            // Continuar con otros comodatos aunque uno falle
          }
        }
      }

      this.logger.log(`Subscription ${subscriptionId} cancelled successfully`);
      return this.mapToResponseDto(updatedSubscription);
    });
  }

  /**
   * Crea un nuevo comodato independiente para una nueva suscripción
   * @param subscriptionId ID de la nueva suscripción
   * @param productId ID del producto del comodato
   * @param quantity Cantidad del producto
   * @returns Comodato creado
   */
  async createIndependentComodato(
    subscriptionId: number,
    productId: number,
    quantity: number,
  ) {
    this.logger.log(
      `Creating independent comodato for subscription: ${subscriptionId}`,
    );

    return this.$transaction(async (prisma) => {
      // Verificar que la suscripción existe
      const subscription = await prisma.customer_subscription.findUnique({
        where: { subscription_id: subscriptionId },
      });

      if (!subscription) {
        throw new NotFoundException(
          `Suscripción con ID ${subscriptionId} no encontrada`,
        );
      }

      // Verificar que el producto existe
      const product = await prisma.product.findUnique({
        where: { product_id: productId },
      });

      if (!product) {
        throw new NotFoundException(
          `Producto con ID ${productId} no encontrado`,
        );
      }

      // Crear el comodato independiente
      const comodato = await prisma.comodato.create({
        data: {
          person_id: subscription.customer_id,
          subscription_id: subscriptionId,
          product_id: productId,
          quantity: quantity,
          delivery_date: new Date(),
          status: 'ACTIVE',
          notes: `Comodato independiente creado para nueva suscripción ${subscriptionId}`,
        },
      });

      this.logger.log(
        `Independent comodato ${comodato.comodato_id} created successfully`,
      );
      return comodato;
    });
  }
}
