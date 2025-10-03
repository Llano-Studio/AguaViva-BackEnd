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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
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
  SubscriptionDeliveryScheduleResponseDto,
} from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SubscriptionCycleRenewalService } from '../common/services/subscription-cycle-renewal.service';

@ApiTags('Suscripciones de Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, UserRolesGuard)
@Controller('customer-subscriptions')
export class CustomerSubscriptionController {
  constructor(
    private readonly customerSubscriptionService: CustomerSubscriptionService,
    private readonly subscriptionCycleRenewalService: SubscriptionCycleRenewalService,
  ) {}

  @Post()
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Crear nueva suscripción de cliente',
    description: `Crea una nueva suscripción asociando un cliente con un plan específico y configurando ciclos automáticos.

## 📋 GESTIÓN DE SUSCRIPCIONES

**Funcionalidad Principal:**
- Asociación cliente-plan de suscripción
- Configuración automática de ciclos de facturación
- Definición de días de recolección/entrega
- Modalidades de pago flexibles

## 📅 CONFIGURACIÓN DE CICLOS

**Día de Recolección (collection_day):**
- Rango válido: 1-28 del mes
- Define cuándo se recolectan bidones
- Base para cálculo de ciclos automáticos
- Ejemplo: collection_day=15 → ciclos del 15 al 15

**Modalidades de Pago:**
- **ADVANCE**: Pago adelantado (antes del servicio)
- **ARREARS**: Pago vencido (después del servicio)
- **payment_due_day**: Día específico de vencimiento

## 🔄 GENERACIÓN AUTOMÁTICA

**Proceso del Sistema:**
- Cálculo automático de fechas de ciclo
- Generación de períodos de facturación
- Configuración de fechas de vencimiento
- Integración con sistema de cobranzas

## 🎯 CASOS DE USO

- **Nuevas Suscripciones**: Clientes que inician servicio
- **Planes Personalizados**: Configuraciones específicas
- **Gestión de Ciclos**: Control de períodos de servicio
- **Modalidades Flexibles**: Adaptación a necesidades del cliente`,
  })
  @ApiBody({ type: CreateCustomerSubscriptionDto })
  @ApiResponse({
    status: 201,
    description: 'Suscripción creada exitosamente',
    type: CustomerSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos o el cliente ya tiene una suscripción activa para este plan',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente o plan de suscripción no encontrado',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description:
      'Prohibido - El usuario no tiene rol de SUPERADMIN o BOSSADMINISTRATIVE.',
  })
  async create(
    @Body(ValidationPipe) createDto: CreateCustomerSubscriptionDto,
  ): Promise<CustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.create(createDto);
  }

  @Get()
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Listar suscripciones de clientes',
    description: `Obtiene una lista paginada de suscripciones con filtros avanzados y búsqueda inteligente.

## 🔍 FILTROS AVANZADOS

**Búsqueda Inteligente (search):**
- Busca en nombres de clientes
- Busca en nombres de planes
- Busca en códigos de suscripción
- Búsqueda parcial y sin distinción de mayúsculas

**Filtros Específicos:**
- **customer_id**: Suscripciones de un cliente específico
- **subscription_plan_id**: Suscripciones de un plan específico
- **status**: Estados (ACTIVE, PAUSED, CANCELLED, EXPIRED)
- **start_date_from/to**: Rango de fechas de inicio
- **only_active**: Solo suscripciones activas/no expiradas

## 📊 INFORMACIÓN INCLUIDA

**Datos de Suscripción:**
- Información completa del cliente
- Detalles del plan de suscripción
- Estado actual y fechas importantes
- Configuración de ciclos y pagos
- Preferencias de entrega

## 🎯 CASOS DE USO

- **Gestión Comercial**: Análisis de suscripciones activas
- **Seguimiento de Clientes**: Historial de suscripciones por cliente
- **Control de Planes**: Popularidad y uso de planes
- **Administración**: Gestión masiva de suscripciones
- **Reportes**: Generación de informes comerciales`,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Elementos por página',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Búsqueda general',
  })
  @ApiQuery({
    name: 'customer_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID del cliente',
  })
  @ApiQuery({
    name: 'subscription_plan_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID del plan',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'],
    description: 'Filtrar por estado',
  })
  @ApiQuery({
    name: 'start_date_from',
    required: false,
    type: String,
    description: 'Fecha de inicio desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'start_date_to',
    required: false,
    type: String,
    description: 'Fecha de inicio hasta (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'only_active',
    required: false,
    type: Boolean,
    description: 'Solo suscripciones activas/no expiradas',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Campo por el cual ordenar',
    example: 'subscription_id',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Orden ascendente o descendente',
    example: 'asc',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de suscripciones obtenida exitosamente',
    type: PaginatedCustomerSubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filters: FilterCustomerSubscriptionsDto,
  ): Promise<PaginatedCustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.findAll(filters);
  }

  @Get(':id')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener suscripción por ID',
    description: `Obtiene los detalles completos de una suscripción específica con toda la información relacionada.

## 📋 INFORMACIÓN INCLUIDA

**Datos del Cliente:**
- Información personal completa
- Datos de contacto y ubicación
- Historial de suscripciones

**Detalles del Plan:**
- Configuración del plan de suscripción
- Precios y modalidades de pago
- Productos incluidos

**Información de Suscripción:**
- Estado actual (ACTIVE, PAUSED, CANCELLED, EXPIRED)
- Fechas de inicio, fin y renovación
- Configuración de ciclos de facturación
- Día de recolección y modalidad de pago

**Preferencias de Entrega:**
- Horarios configurados por día
- Preferencias especiales
- Configuración de entregas

## 🎯 CASOS DE USO

- **Atención al Cliente**: Consulta completa de suscripción
- **Gestión Operativa**: Planificación de entregas y recolecciones
- **Administración**: Modificación de configuraciones
- **Facturación**: Información para generación de facturas`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la suscripción',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Suscripción encontrada exitosamente',
    type: CustomerSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar suscripción',
    description: `Actualiza los datos de una suscripción existente con validaciones de negocio y mantenimiento de integridad.

## 🔧 CAMPOS ACTUALIZABLES

**Configuración del Plan:**
- **subscription_plan_id**: Cambio de plan de suscripción
- Validación de plan activo y disponible
- Recálculo automático de precios y ciclos

**Configuración de Ciclos:**
- **collection_day**: Día de recolección (1-28)
- **payment_mode**: ADVANCE (adelantado) o ARREARS (vencido)
- **payment_due_day**: Día de vencimiento para pagos vencidos

**Estado y Configuración:**
- **status**: ACTIVE, PAUSED, CANCELLED, EXPIRED
- **notes**: Notas adicionales y observaciones
- **delivery_preferences**: Horarios de entrega por día

## ⚙️ VALIDACIONES AUTOMÁTICAS

**Reglas de Negocio:**
- Verificación de estado válido para cambios
- Validación de fechas y rangos permitidos
- Consistencia entre modalidad de pago y días de vencimiento
- Integridad referencial con planes y clientes

**Recálculos Automáticos:**
- Ajuste de ciclos de facturación al cambiar collection_day
- Actualización de fechas de vencimiento
- Sincronización con órdenes pendientes

## 🎯 CASOS DE USO

- **Cambio de Plan**: Upgrade/downgrade de suscripciones
- **Ajuste de Configuración**: Modificación de días y modalidades
- **Gestión de Estado**: Pausar, reactivar o cancelar suscripciones
- **Personalización**: Ajuste de preferencias de entrega
- **Administración**: Corrección de datos y configuraciones

**Disponible para:** SUPERADMIN y Jefe Administrativo.`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la suscripción',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateCustomerSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: 'Suscripción actualizada exitosamente',
    type: CustomerSubscriptionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateDto: UpdateCustomerSubscriptionDto,
  ): Promise<CustomerSubscriptionResponseDto> {
    return this.customerSubscriptionService.update(id, updateDto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Eliminar suscripción',
    description: 'Elimina permanentemente una suscripción del sistema. Disponible para SUPERADMIN y Jefe Administrativo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la suscripción',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 204,
    description: 'Suscripción eliminada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'No se puede eliminar la suscripción porque tiene registros relacionados',
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.customerSubscriptionService.remove(id);
  }

  @Get('customer/:customerId')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener suscripciones por cliente',
    description: 'Obtiene todas las suscripciones de un cliente específico',
  })
  @ApiParam({
    name: 'customerId',
    description: 'ID del cliente',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Suscripciones del cliente obtenidas exitosamente',
    type: PaginatedCustomerSubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async findByCustomer(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filters: FilterCustomerSubscriptionsDto,
  ): Promise<PaginatedCustomerSubscriptionResponseDto> {
    const customerFilters = { ...filters, customer_id: customerId };
    return this.customerSubscriptionService.findAll(customerFilters);
  }

  @Get('plan/:planId')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener suscripciones por plan',
    description: 'Obtiene todas las suscripciones de un plan específico',
  })
  @ApiParam({
    name: 'planId',
    description: 'ID del plan de suscripción',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Suscripciones del plan obtenidas exitosamente',
    type: PaginatedCustomerSubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async findByPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filters: FilterCustomerSubscriptionsDto,
  ): Promise<PaginatedCustomerSubscriptionResponseDto> {
    const planFilters = { ...filters, subscription_plan_id: planId };
    return this.customerSubscriptionService.findAll(planFilters);
  }

  @Patch(':id/delivery-preferences')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar preferencias de horario de entrega',
    description:
      'Actualiza las preferencias de horario de entrega para una suscripción específica',
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
      delivery_preferences: deliveryPreferences,
    });
  }

  @Get(':id/delivery-preferences')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener preferencias de horario de entrega',
    description:
      'Obtiene las preferencias de horario de entrega para una suscripción específica',
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
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Crear horario de entrega para suscripción',
    description:
      'Crea un nuevo horario de entrega para una suscripción específica. El campo `scheduled_time` acepta formato puntual `HH:MM` o rango `HH:MM-HH:MM`.',
  })
  @ApiBody({
    description:
      'Datos para crear un horario de entrega: día de la semana (1=Lunes...7=Domingo) y horario puntual o rango.',
    type: CreateSubscriptionDeliveryScheduleDto,
    examples: {
      puntual: {
        summary: 'Horario puntual',
        value: { day_of_week: 1, scheduled_time: '09:30' },
      },
      rango: {
        summary: 'Rango horario',
        value: { day_of_week: 5, scheduled_time: '14:00-16:00' },
      },
    },
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
    @Body()
    createDto: Omit<CreateSubscriptionDeliveryScheduleDto, 'subscription_id'>,
  ): Promise<SubscriptionDeliveryScheduleResponseDto> {
    return this.customerSubscriptionService.createDeliverySchedule({
      ...createDto,
      subscription_id: subscriptionId,
    });
  }

  @Get(':id/delivery-schedules')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener horarios de entrega de una suscripción',
    description:
      'Obtiene todos los horarios de entrega configurados para una suscripción',
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
    return this.customerSubscriptionService.findDeliverySchedulesBySubscription(
      subscriptionId,
    );
  }

  @Patch('delivery-schedules/:scheduleId')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar horario de entrega',
    description: 'Actualiza un horario de entrega específico',
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
    return this.customerSubscriptionService.updateDeliverySchedule(
      scheduleId,
      updateDto,
    );
  }

  @Delete('delivery-schedules/:scheduleId')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Eliminar horario de entrega',
    description: 'Elimina un horario de entrega específico',
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
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener horarios de entrega por día',
    description:
      'Obtiene todos los horarios de entrega configurados para un día específico de la semana',
  })
  @ApiParam({
    name: 'dayOfWeek',
    description: 'Día de la semana (1=Lunes, 2=Martes, ..., 7=Domingo)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Horarios de entrega obtenidos exitosamente',
    type: [SubscriptionDeliveryScheduleResponseDto],
  })
  async getDeliverySchedulesByDay(
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
  ): Promise<SubscriptionDeliveryScheduleResponseDto[]> {
    return this.customerSubscriptionService.findDeliverySchedulesByDay(
      dayOfWeek,
    );
  }

  @Post('admin/force-cycle-renewal')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forzar renovación de ciclos',
    description:
      'Ejecuta manualmente la renovación de ciclos de suscripción expirados (solo para administradores)',
  })
  @ApiResponse({
    status: 200,
    description: 'Renovación de ciclos ejecutada exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN.',
  })
  async forceCycleRenewal(): Promise<{ message: string }> {
    await this.subscriptionCycleRenewalService.forceRenewalCheck();
    return { message: 'Renovación de ciclos ejecutada exitosamente' };
  }
}
