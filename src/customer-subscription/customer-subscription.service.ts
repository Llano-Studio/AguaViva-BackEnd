import { Injectable, NotFoundException, BadRequestException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma, SubscriptionStatus } from '@prisma/client';
import {
  CreateCustomerSubscriptionDto,
  UpdateCustomerSubscriptionDto,
  FilterCustomerSubscriptionsDto,
  CustomerSubscriptionResponseDto,
  PaginatedCustomerSubscriptionResponseDto,
  CreateSubscriptionDeliveryScheduleDto,
  UpdateSubscriptionDeliveryScheduleDto,
  SubscriptionDeliveryScheduleResponseDto
} from './dto';

@Injectable()
export class CustomerSubscriptionService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(CustomerSubscriptionService.name);

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

  private buildNotesWithPreferences(clientNotes?: string | null, newPreferences?: any): string | null {
    // Si no hay notas del cliente ni preferencias, retornar null
    if ((!clientNotes || clientNotes.trim() === '') && !newPreferences) return null;
    
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

  async create(createDto: CreateCustomerSubscriptionDto): Promise<CustomerSubscriptionResponseDto> {
    this.logger.log(`Creating subscription for customer: ${createDto.customer_id}`);

    // Verificar que el cliente existe
    const customer = await this.person.findUnique({
      where: { person_id: createDto.customer_id },
    });

    if (!customer) {
      throw new NotFoundException(`Cliente con ID ${createDto.customer_id} no encontrado`);
    }

    // Verificar que el plan de suscripción existe
    const subscriptionPlan = await this.subscription_plan.findUnique({
      where: { subscription_plan_id: createDto.subscription_plan_id },
    });

    if (!subscriptionPlan) {
      throw new NotFoundException(`Plan de suscripción con ID ${createDto.subscription_plan_id} no encontrado`);
    }

    // Verificar que no haya una suscripción activa del mismo plan para el cliente
    const existingActiveSubscription = await this.customer_subscription.findFirst({
      where: {
        customer_id: createDto.customer_id,
        subscription_plan_id: createDto.subscription_plan_id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingActiveSubscription) {
      throw new BadRequestException('El cliente ya tiene una suscripción activa para este plan');
    }

    // Build notes with delivery preferences separados
    const notes = this.buildNotesWithPreferences(
      createDto.notes, 
      createDto.delivery_preferences
    );

    try {
      const subscription = await this.customer_subscription.create({
        data: {
          customer_id: createDto.customer_id,
          subscription_plan_id: createDto.subscription_plan_id,
          start_date: new Date(createDto.start_date),
          end_date: createDto.end_date ? new Date(createDto.end_date) : null,
          status: createDto.status || SubscriptionStatus.ACTIVE,
          notes,
        },
        include: {
          subscription_plan: {
            include: {
              subscription_plan_product: true
            }
          },
        },
      });

      // Crear el primer ciclo de suscripción automáticamente
      const firstCycleStartDate = new Date(createDto.start_date);
      const firstCycleEndDate = new Date(firstCycleStartDate);
      firstCycleEndDate.setMonth(firstCycleStartDate.getMonth() + 1);
      firstCycleEndDate.setDate(firstCycleStartDate.getDate() - 1);
      firstCycleEndDate.setHours(23, 59, 59, 999);

      const firstCycle = await this.subscription_cycle.create({
        data: {
          subscription_id: subscription.subscription_id,
          cycle_start: firstCycleStartDate,
          cycle_end: firstCycleEndDate,
          notes: 'Primer ciclo creado automáticamente al crear la suscripción',
        },
      });

      // Crear los detalles del ciclo con las cantidades planificadas del plan
      for (const planProduct of subscription.subscription_plan.subscription_plan_product) {
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

      this.logger.log(`Created first cycle for subscription ${subscription.subscription_id} from ${firstCycleStartDate.toISOString().split('T')[0]} to ${firstCycleEndDate.toISOString().split('T')[0]}`);

      // Crear horarios de entrega según delivery_preferences
      if (createDto.delivery_preferences?.preferred_days && createDto.delivery_preferences.preferred_time_range) {
        const dayNameToNumber: Record<string, number> = {
          MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4,
          FRIDAY: 5, SATURDAY: 6, SUNDAY: 7,
        };
        for (const dayName of createDto.delivery_preferences.preferred_days) {
          const dayOfWeek = dayNameToNumber[dayName.toUpperCase()];
          if (dayOfWeek) {
            await this.subscription_delivery_schedule.create({
              data: {
                subscription_id: subscription.subscription_id,
                day_of_week: dayOfWeek,
                scheduled_time: createDto.delivery_preferences.preferred_time_range,
              },
            });
          }
        }
      }

      const response = new CustomerSubscriptionResponseDto(subscription);
      response.delivery_preferences = this.parseDeliveryPreferences(subscription.notes);
      
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new BadRequestException('Ya existe una suscripción con estos datos');
        }
      }
      throw error;
    }
  }

  async findAll(filters: FilterCustomerSubscriptionsDto): Promise<PaginatedCustomerSubscriptionResponseDto> {
    this.logger.log(`Finding subscriptions with filters: ${JSON.stringify(filters)}`);

    const { page = 1, limit = 10, sortBy = 'subscription_id', ...filterParams } = filters;
    
    const skip = (page - 1) * limit;

    // Construir filtros dinámicos
    const where = this.buildWhereClause(filterParams);

    // Construir ordenamiento dinámico
    const orderBy = this.buildOrderByClause(sortBy as string, 'asc');

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

    const mappedSubscriptions = subscriptions.map(subscription => {
      const response = this.mapToResponseDto(subscription);
      response.delivery_preferences = this.parseDeliveryPreferences(subscription.notes);
      return response;
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: mappedSubscriptions,
      meta: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  async findOne(id: number): Promise<CustomerSubscriptionResponseDto> {
    this.logger.log(`Finding subscription: ${id}`);

    const subscription = await this.customer_subscription.findUnique({
      where: { subscription_id: id },
      include: this.getIncludeClause(),
    });

    if (!subscription) {
      throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
    }

    const response = this.mapToResponseDto(subscription);
    response.delivery_preferences = this.parseDeliveryPreferences(subscription.notes);
    
    return response;
  }

  async update(id: number, updateDto: UpdateCustomerSubscriptionDto): Promise<CustomerSubscriptionResponseDto> {
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
        throw new NotFoundException(`Plan de suscripción con ID ${updateDto.subscription_plan_id} no encontrado`);
      }
    }

    // Build notes with delivery preferences, manteniendo notas del cliente existentes si no se proveen nuevas
    const currentClientNotes = this.parseClientNotes(existingSubscription.notes);
    const finalClientNotes = updateDto.notes !== undefined ? updateDto.notes : currentClientNotes;
    const notes = this.buildNotesWithPreferences(
      finalClientNotes, 
      updateDto.delivery_preferences
    );

    try {
      const updateData: any = {};
      
      if (updateDto.subscription_plan_id !== undefined) {
        updateData.subscription_plan_id = updateDto.subscription_plan_id;
      }
      if (updateDto.end_date !== undefined) {
        updateData.end_date = updateDto.end_date ? new Date(updateDto.end_date) : null;
      }
      if (updateDto.status !== undefined) {
        updateData.status = updateDto.status;
      }
      if (updateDto.notes !== undefined || updateDto.delivery_preferences !== undefined) {
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
      response.delivery_preferences = this.parseDeliveryPreferences(subscription.notes);
      
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
        }
        throw new BadRequestException(`Error al actualizar la suscripción: ${error.message}`);
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
        `No se puede eliminar la suscripción porque tiene ${subscription.order_header.length} orden(es) asociada(s). Debe cancelar primero las órdenes relacionadas.`
      );
    }

    try {
      // Usar transacción para asegurar consistencia
      await this.$transaction(async (prisma) => {
        // 1. Eliminar los horarios de entrega
        if (subscription.subscription_delivery_schedule && subscription.subscription_delivery_schedule.length > 0) {
          await prisma.subscription_delivery_schedule.deleteMany({
            where: { subscription_id: id },
          });
          this.logger.log(`Deleted ${subscription.subscription_delivery_schedule.length} delivery schedule(s) for subscription ${id}`);
        }

        // 2. Eliminar los detalles de ciclos primero
        for (const cycle of subscription.subscription_cycle || []) {
          await prisma.subscription_cycle_detail.deleteMany({
            where: { cycle_id: cycle.cycle_id },
          });
        }

        // 3. Eliminar los ciclos de suscripción
        if (subscription.subscription_cycle && subscription.subscription_cycle.length > 0) {
          await prisma.subscription_cycle.deleteMany({
            where: { subscription_id: id },
          });
          this.logger.log(`Deleted ${subscription.subscription_cycle.length} subscription cycle(s) for subscription ${id}`);
        }

        // 4. Finalmente eliminar la suscripción
        await prisma.customer_subscription.delete({
          where: { subscription_id: id },
        });
        
        this.logger.log(`Successfully deleted subscription ${id}`);
      });
    } catch (error) {
      this.logger.error(`Error deleting subscription ${id}:`, error);
      
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new BadRequestException('No se puede eliminar la suscripción debido a restricciones de integridad de datos. Verifique que no existan registros relacionados.');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException(`Suscripción con ID ${id} no encontrada`);
        }
      }
      throw new BadRequestException(`Error al eliminar la suscripción: ${error.message}`);
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
      },
      _count: {
        select: { order_header: true },
      },
    };
  }

  private buildWhereClause(filters: Partial<FilterCustomerSubscriptionsDto>): Prisma.customer_subscriptionWhereInput {
    const where: Prisma.customer_subscriptionWhereInput = {};

    if (filters.customer_id) {
      where.customer_id = filters.customer_id;
    }

    if (filters.subscription_plan_id) {
      where.subscription_plan_id = filters.subscription_plan_id;
    }

    if (filters.status) {
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

    if (filters.end_date_from || filters.end_date_to) {
      where.end_date = {};
      if (filters.end_date_from) {
        const fromDate = new Date(filters.end_date_from);
        fromDate.setHours(0, 0, 0, 0);
        where.end_date.gte = fromDate;
      }
      if (filters.end_date_to) {
        const toDate = new Date(filters.end_date_to);
        toDate.setHours(23, 59, 59, 999);
        where.end_date.lte = toDate;
      }
    }

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
            { end_date: null },
            { end_date: { gt: new Date() } },
          ],
        },
      ];
    }

    return where;
  }

  private buildOrderByClause(sortBy: string, sortOrder: 'asc' | 'desc'): Prisma.customer_subscriptionOrderByWithRelationInput {
    const orderBy: Prisma.customer_subscriptionOrderByWithRelationInput = {};

    switch (sortBy) {
      case 'start_date':
        orderBy.start_date = sortOrder;
        break;
      case 'end_date':
        orderBy.end_date = sortOrder;
        break;
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
      end_date: subscription.end_date ? subscription.end_date.toISOString().split('T')[0] : null,
      status: subscription.status,
      notes: this.parseClientNotes(subscription.notes),
      customer: {
        person_id: subscription.person?.person_id || subscription.customer_id,
        name: subscription.person?.name || 'Cliente',
        phone: subscription.person?.phone || '',
        address: subscription.person?.address || '',
        zone: subscription.person?.zone ? {
          zone_id: subscription.person.zone.zone_id,
          name: subscription.person.zone.name,
          locality: {
            locality_id: subscription.person.zone.locality.locality_id,
            name: subscription.person.zone.locality.name,
          },
        } : undefined,
      },
      subscription_plan: {
        subscription_plan_id: subscription.subscription_plan.subscription_plan_id,
        name: subscription.subscription_plan.name,
        description: subscription.subscription_plan.description,
        price: subscription.subscription_plan.price?.toString(),
      },
      subscription_cycle: subscription.subscription_cycle?.map((cycle: any) => ({
        cycle_id: cycle.cycle_id,
        cycle_start: cycle.cycle_start.toISOString().split('T')[0],
        cycle_end: cycle.cycle_end.toISOString().split('T')[0],
        notes: cycle.notes,
      })),
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
  private validateScheduledTime(scheduledTime: string): { isValid: boolean; type: 'puntual' | 'rango'; startTime?: string; endTime?: string; error?: string } {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    
    if (scheduledTime.includes('-')) {
      // Formato de rango: HH:MM-HH:MM
      const [startTime, endTime] = scheduledTime.split('-').map(t => t.trim());
      
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return { isValid: false, type: 'rango', error: 'Formato inválido para rango horario. Use HH:MM-HH:MM' };
      }
      
      // Verificar que la hora de inicio sea menor que la de fin
      const startMinutes = this.timeToMinutes(startTime);
      const endMinutes = this.timeToMinutes(endTime);
      
      if (startMinutes >= endMinutes) {
        return { isValid: false, type: 'rango', error: 'La hora de inicio debe ser menor que la hora de fin' };
      }
      
      return { isValid: true, type: 'rango', startTime, endTime };
    } else {
      // Formato puntual: HH:MM
      if (!timeRegex.test(scheduledTime)) {
        return { isValid: false, type: 'puntual', error: 'Formato inválido para horario puntual. Use HH:MM' };
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
      start: this.timeToMinutes(parsed1.startTime!),
      end: parsed1.type === 'rango' ? this.timeToMinutes(parsed1.endTime!) : this.timeToMinutes(parsed1.startTime!) + 30 // 30 min para puntuales
    };
    
    const range2 = {
      start: this.timeToMinutes(parsed2.startTime!),
      end: parsed2.type === 'rango' ? this.timeToMinutes(parsed2.endTime!) : this.timeToMinutes(parsed2.startTime!) + 30 // 30 min para puntuales
    };
    
    // Verificar superposición
    return (range1.start < range2.end && range2.start < range1.end);
  }

  async createDeliverySchedule(createDto: CreateSubscriptionDeliveryScheduleDto): Promise<SubscriptionDeliveryScheduleResponseDto> {
    this.logger.log(`Creating delivery schedule for subscription: ${createDto.subscription_id}`);

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
      throw new NotFoundException(`Suscripción con ID ${createDto.subscription_id} no encontrada`);
    }

    // Verificar que no haya horarios que se superpongan en el mismo día
    const existingSchedules = await this.subscription_delivery_schedule.findMany({
      where: {
        subscription_id: createDto.subscription_id,
        day_of_week: createDto.day_of_week,
      },
    });

    for (const existingSchedule of existingSchedules) {
      const normalizedExistingTime = this.normalizeScheduledTime(existingSchedule.scheduled_time);
      if (this.checkTimeOverlap(createDto.scheduled_time, normalizedExistingTime)) {
        throw new BadRequestException(
          `El horario ${createDto.scheduled_time} se superpone con el horario existente ${normalizedExistingTime} para el día ${createDto.day_of_week}`
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

  async findDeliverySchedulesBySubscription(subscriptionId: number): Promise<SubscriptionDeliveryScheduleResponseDto[]> {
    this.logger.log(`Finding delivery schedules for subscription: ${subscriptionId}`);

    const schedules = await this.subscription_delivery_schedule.findMany({
      where: { subscription_id: subscriptionId },
      orderBy: { day_of_week: 'asc' },
    });

    return schedules.map(schedule => new SubscriptionDeliveryScheduleResponseDto(schedule));
  }

  async updateDeliverySchedule(
    scheduleId: number,
    updateDto: UpdateSubscriptionDeliveryScheduleDto
  ): Promise<SubscriptionDeliveryScheduleResponseDto> {
    this.logger.log(`Updating delivery schedule: ${scheduleId}`);

    const existingSchedule = await this.subscription_delivery_schedule.findUnique({
      where: { schedule_id: scheduleId },
    });

    if (!existingSchedule) {
      throw new NotFoundException(`Horario de entrega con ID ${scheduleId} no encontrado`);
    }

    // Validar formato del horario si se está actualizando
    if (updateDto.scheduled_time) {
      const timeValidation = this.validateScheduledTime(updateDto.scheduled_time);
      if (!timeValidation.isValid) {
        throw new BadRequestException(timeValidation.error);
      }
    }

    const targetDayOfWeek = updateDto.day_of_week ?? existingSchedule.day_of_week;
    const targetScheduledTime = updateDto.scheduled_time ?? this.normalizeScheduledTime(existingSchedule.scheduled_time);

    // Verificar que no haya horarios que se superpongan en el día (si se cambia día o hora)
    if (updateDto.day_of_week || updateDto.scheduled_time) {
      const conflictingSchedules = await this.subscription_delivery_schedule.findMany({
        where: {
          subscription_id: existingSchedule.subscription_id,
          day_of_week: targetDayOfWeek,
          schedule_id: { not: scheduleId },
        },
      });

      for (const conflictingSchedule of conflictingSchedules) {
        const conflictingTime = this.normalizeScheduledTime(conflictingSchedule.scheduled_time);

        if (this.checkTimeOverlap(targetScheduledTime, conflictingTime)) {
          throw new BadRequestException(
            `El horario ${targetScheduledTime} se superpone con el horario existente ${conflictingTime} para el día ${targetDayOfWeek}`
          );
        }
      }
    }

    const updatedSchedule = await this.subscription_delivery_schedule.update({
      where: { schedule_id: scheduleId },
      data: {
        ...(updateDto.day_of_week && { day_of_week: updateDto.day_of_week }),
        ...(updateDto.scheduled_time && { scheduled_time: updateDto.scheduled_time }),
      },
    });

    return new SubscriptionDeliveryScheduleResponseDto(updatedSchedule);
  }

  async deleteDeliverySchedule(scheduleId: number): Promise<void> {
    this.logger.log(`Deleting delivery schedule: ${scheduleId}`);

    const existingSchedule = await this.subscription_delivery_schedule.findUnique({
      where: { schedule_id: scheduleId },
    });

    if (!existingSchedule) {
      throw new NotFoundException(`Horario de entrega con ID ${scheduleId} no encontrado`);
    }

    await this.subscription_delivery_schedule.delete({
      where: { schedule_id: scheduleId },
    });
  }

  async findDeliverySchedulesByDay(dayOfWeek: number): Promise<SubscriptionDeliveryScheduleResponseDto[]> {
    this.logger.log(`Finding delivery schedules for day: ${dayOfWeek}`);

    const schedules = await this.subscription_delivery_schedule.findMany({
      where: { day_of_week: dayOfWeek },
      include: {
        customer_subscription: {
          include: {
            subscription_plan: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { scheduled_time: 'asc' },
    });

    return schedules.map(schedule => new SubscriptionDeliveryScheduleResponseDto(schedule));
  }
}