import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  ParseIntPipe, 
  HttpCode, 
  HttpStatus,
  ValidationPipe,
  UseGuards
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiBearerAuth, 
  ApiQuery,
  ApiBody 
} from '@nestjs/swagger';
import { CustomerSubscriptionService } from './customer-subscription.service';
import {
  CreateCustomerSubscriptionDto,
  UpdateCustomerSubscriptionDto,
  FilterCustomerSubscriptionsDto,
  CustomerSubscriptionResponseDto,
  PaginatedCustomerSubscriptionResponseDto,
  DeliveryPreferences,
  CreateSubscriptionDeliveryScheduleDto,
  UpdateSubscriptionDeliveryScheduleDto,
  SubscriptionDeliveryScheduleResponseDto
} from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Suscripciones de Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserRolesGuard)
@Controller('customer-subscriptions')
export class CustomerSubscriptionController {
  constructor(private readonly customerSubscriptionService: CustomerSubscriptionService) {}

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Crear nueva suscripción de cliente',
    description: 'Crea una nueva suscripción asociando un cliente con un plan de suscripción'
  })
  @ApiBody({ type: CreateCustomerSubscriptionDto })
  @ApiResponse({
    status: 201,
    description: 'Suscripción creada exitosamente',
    type: CustomerSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o el cliente ya tiene una suscripción activa para este plan'
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente o plan de suscripción no encontrado'
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  async create(@Body(ValidationPipe) createDto: CreateCustomerSubscriptionDto): Promise<CustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.create(createDto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Listar suscripciones de clientes',
    description: 'Obtiene una lista paginada de suscripciones con filtros opcionales'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Elementos por página', example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda general' })
  @ApiQuery({ name: 'customer_id', required: false, type: Number, description: 'Filtrar por ID del cliente' })
  @ApiQuery({ name: 'subscription_plan_id', required: false, type: Number, description: 'Filtrar por ID del plan' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'], description: 'Filtrar por estado' })
  @ApiQuery({ name: 'start_date_from', required: false, type: String, description: 'Fecha de inicio desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'start_date_to', required: false, type: String, description: 'Fecha de inicio hasta (YYYY-MM-DD)' })
  @ApiQuery({ name: 'only_active', required: false, type: Boolean, description: 'Solo suscripciones activas/no expiradas' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Campo por el cual ordenar', example: 'subscription_id' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Orden ascendente o descendente', example: 'asc' })
  @ApiResponse({
    status: 200,
    description: 'Lista de suscripciones obtenida exitosamente',
    type: PaginatedCustomerSubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) 
    filters: FilterCustomerSubscriptionsDto
  ): Promise<PaginatedCustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.findAll(filters);
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener suscripción por ID',
    description: 'Obtiene los detalles completos de una suscripción específica'
  })
  @ApiParam({ name: 'id', description: 'ID de la suscripción', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Suscripción encontrada exitosamente',
    type: CustomerSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada'
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<CustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Actualizar suscripción',
    description: 'Actualiza los datos de una suscripción existente'
  })
  @ApiParam({ name: 'id', description: 'ID de la suscripción', type: Number, example: 1 })
  @ApiBody({ type: UpdateCustomerSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: 'Suscripción actualizada exitosamente',
    type: CustomerSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos'
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada'
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateCustomerSubscriptionDto
  ): Promise<CustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.update(id, updateDto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Eliminar suscripción',
    description: 'Elimina permanentemente una suscripción del sistema'
  })
  @ApiParam({ name: 'id', description: 'ID de la suscripción', type: Number, example: 1 })
  @ApiResponse({
    status: 204,
    description: 'Suscripción eliminada exitosamente'
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar la suscripción porque tiene registros relacionados'
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada'
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.customerSubscriptionService.remove(id);
  }

  @Get('customer/:customerId')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener suscripciones por cliente',
    description: 'Obtiene todas las suscripciones de un cliente específico'
  })
  @ApiParam({ name: 'customerId', description: 'ID del cliente', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Suscripciones del cliente obtenidas exitosamente',
    type: PaginatedCustomerSubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async findByCustomer(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) 
    filters: FilterCustomerSubscriptionsDto
  ): Promise<PaginatedCustomerSubscriptionResponseDto> {
    const customerFilters = { ...filters, customer_id: customerId };
    return this.customerSubscriptionService.findAll(customerFilters);
  }

  @Get('plan/:planId')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener suscripciones por plan',
    description: 'Obtiene todas las suscripciones de un plan específico'
  })
  @ApiParam({ name: 'planId', description: 'ID del plan de suscripción', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Suscripciones del plan obtenidas exitosamente',
    type: PaginatedCustomerSubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async findByPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) 
    filters: FilterCustomerSubscriptionsDto
  ): Promise<PaginatedCustomerSubscriptionResponseDto> {
    const planFilters = { ...filters, subscription_plan_id: planId };
    return this.customerSubscriptionService.findAll(planFilters);
  }

  @Patch(':id/delivery-preferences')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Actualizar preferencias de horario de entrega',
    description: 'Actualiza las preferencias de horario de entrega para una suscripción específica'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferencias de horario actualizadas exitosamente',
    type: CustomerSubscriptionResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Suscripción no encontrada',
  })
  async updateDeliveryPreferences(
    @Param('id', ParseIntPipe) id: number,
    @Body() deliveryPreferences: DeliveryPreferences,
  ): Promise<CustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.update(id, { 
      delivery_preferences: deliveryPreferences 
    });
  }

  @Get(':id/delivery-preferences')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener preferencias de horario de entrega',
    description: 'Obtiene las preferencias de horario de entrega para una suscripción específica'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preferencias de horario obtenidas exitosamente',
    type: DeliveryPreferences,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Suscripción no encontrada',
  })
  async getDeliveryPreferences(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DeliveryPreferences | null> {
    const subscription = await this.customerSubscriptionService.findOne(id);
    return subscription.delivery_preferences || null;
  }

  // =============================================================================
  // ENDPOINTS PARA HORARIOS DE ENTREGA
  // =============================================================================

  @Post(':id/delivery-schedules')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Crear horario de entrega para suscripción',
    description: 'Crea un nuevo horario de entrega para una suscripción específica. El campo `scheduled_time` acepta formato puntual `HH:MM` o rango `HH:MM-HH:MM`.'
  })
  @ApiBody({
    description: 'Datos para crear un horario de entrega: día de la semana (1=Lunes...7=Domingo) y horario puntual o rango.',
    type: CreateSubscriptionDeliveryScheduleDto,
    examples: {
      puntual: {
        summary: 'Horario puntual',
        value: { day_of_week: 1, scheduled_time: '09:30' }
      },
      rango: {
        summary: 'Rango horario',
        value: { day_of_week: 5, scheduled_time: '14:00-16:00' }
      }
    }
  })
  @ApiParam({ name: 'id', description: 'ID de la suscripción' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Horario de entrega creado exitosamente',
    type: SubscriptionDeliveryScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Suscripción no encontrada',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Ya existe un horario para este día',
  })
  async createDeliverySchedule(
    @Param('id', ParseIntPipe) subscriptionId: number,
    @Body() createDto: Omit<CreateSubscriptionDeliveryScheduleDto, 'subscription_id'>,
  ): Promise<SubscriptionDeliveryScheduleResponseDto> {
    return this.customerSubscriptionService.createDeliverySchedule({
      ...createDto,
      subscription_id: subscriptionId,
    });
  }

  @Get(':id/delivery-schedules')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener horarios de entrega de una suscripción',
    description: 'Obtiene todos los horarios de entrega configurados para una suscripción'
  })
  @ApiParam({ name: 'id', description: 'ID de la suscripción' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Horarios de entrega obtenidos exitosamente',
    type: [SubscriptionDeliveryScheduleResponseDto],
  })
  async getDeliverySchedules(
    @Param('id', ParseIntPipe) subscriptionId: number,
  ): Promise<SubscriptionDeliveryScheduleResponseDto[]> {
    return this.customerSubscriptionService.findDeliverySchedulesBySubscription(subscriptionId);
  }

  @Patch('delivery-schedules/:scheduleId')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Actualizar horario de entrega',
    description: 'Actualiza un horario de entrega específico'
  })
  @ApiParam({ name: 'scheduleId', description: 'ID del horario de entrega' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Horario de entrega actualizado exitosamente',
    type: SubscriptionDeliveryScheduleResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Horario de entrega no encontrado',
  })
  async updateDeliverySchedule(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
    @Body() updateDto: UpdateSubscriptionDeliveryScheduleDto,
  ): Promise<SubscriptionDeliveryScheduleResponseDto> {
    return this.customerSubscriptionService.updateDeliverySchedule(scheduleId, updateDto);
  }

  @Delete('delivery-schedules/:scheduleId')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Eliminar horario de entrega',
    description: 'Elimina un horario de entrega específico'
  })
  @ApiParam({ name: 'scheduleId', description: 'ID del horario de entrega' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Horario de entrega eliminado exitosamente',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Horario de entrega no encontrado',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDeliverySchedule(
    @Param('scheduleId', ParseIntPipe) scheduleId: number,
  ): Promise<void> {
    return this.customerSubscriptionService.deleteDeliverySchedule(scheduleId);
  }

  @Get('delivery-schedules/by-day/:dayOfWeek')
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener horarios de entrega por día',
    description: 'Obtiene todos los horarios de entrega configurados para un día específico de la semana'
  })
  @ApiParam({ 
    name: 'dayOfWeek', 
    description: 'Día de la semana (1=Lunes, 2=Martes, ..., 7=Domingo)' 
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Horarios de entrega obtenidos exitosamente',
    type: [SubscriptionDeliveryScheduleResponseDto],
  })
  async getDeliverySchedulesByDay(
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
  ): Promise<SubscriptionDeliveryScheduleResponseDto[]> {
    return this.customerSubscriptionService.findDeliverySchedulesByDay(dayOfWeek);
  }
} 