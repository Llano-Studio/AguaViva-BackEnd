import { 
  Body, 
  Controller, 
  Delete, 
  Get, 
  Param, 
  ParseIntPipe, 
  Patch, 
  Post, 
  Query, 
  ValidationPipe,
  Put,
  UseGuards
} from '@nestjs/common';
import { 
  ApiBearerAuth, 
  ApiOperation, 
  ApiResponse, 
  ApiTags,
  ApiBody,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { 
  CreateRouteSheetDto, 
  FilterRouteSheetsDto, 
  PrintRouteSheetDto, 
  RouteSheetResponseDto, 
  UpdateRouteSheetDto,
  CreateRouteOptimizationDto,
  RouteOptimizationResponseDto,
  CreateVehicleRouteInventoryDto,
  VehicleRouteInventoryResponseDto,
  InventoryTransactionDto,
  ReconcileRouteSheetDto,
  RecordPaymentDto,
  SkipDeliveryDto,
  RouteSheetDetailResponseDto,
  ValidateDeliveryTimesDto,
  DeliveryTimeValidationResponseDto,
  UpdateDeliveryTimeDto
} from './dto';
import { RouteSheetService } from './route-sheet.service';
import { RouteOptimizationService } from './services/route-optimization.service';
import { MobileInventoryService } from './services/mobile-inventory.service';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FailedOrderReassignmentService } from '../common/services/failed-order-reassignment.service';

@ApiTags('Hojas de Ruta')
@ApiBearerAuth()
@Controller('route-sheets')
export class RouteSheetController {
  constructor(
    private readonly routeSheetService: RouteSheetService,
    private readonly routeOptimizationService: RouteOptimizationService,
    private readonly mobileInventoryService: MobileInventoryService,
    private readonly failedOrderReassignmentService: FailedOrderReassignmentService
  ) {}

  @Post()
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Crear una nueva hoja de ruta' })
  @ApiBody({ type: CreateRouteSheetDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Hoja de ruta creada exitosamente',
    type: RouteSheetResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  create(@Body() createRouteSheetDto: CreateRouteSheetDto) {
    return this.routeSheetService.create(createRouteSheetDto);
  }

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener todas las hojas de ruta con filtros y paginación' })
  @ApiQuery({ name: 'driver_id', required: false, type: Number, description: 'Filtrar por ID del conductor' })
  @ApiQuery({ name: 'vehicle_id', required: false, type: Number, description: 'Filtrar por ID del vehículo' })
  @ApiQuery({ name: 'from_date', required: false, type: String, description: 'Filtrar por fecha desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to_date', required: false, type: String, description: 'Filtrar por fecha hasta (YYYY-MM-DD)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: "Campos para ordenar. Prefijo '-' para descendente. Ej: delivery_date,-driver.name", example: "delivery_date,-driver.name" })
  @ApiResponse({ 
    status: 200, 
    description: 'Listado de hojas de ruta',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/RouteSheetResponseDto' }
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' }
          }
        }
      }
    }
  })
  findAll(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }))
    filterDto: FilterRouteSheetsDto
  ) {
    return this.routeSheetService.findAll(filterDto);
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener una hoja de ruta por su ID' })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta', type: Number, example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Hoja de ruta encontrada',
    type: RouteSheetResponseDto
  })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.routeSheetService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Actualizar una hoja de ruta' })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta a actualizar', type: Number, example: 1 })
  @ApiBody({ type: UpdateRouteSheetDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Hoja de ruta actualizada',
    type: RouteSheetResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos' })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRouteSheetDto: UpdateRouteSheetDto
  ) {
    return this.routeSheetService.update(id, updateRouteSheetDto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Eliminar una hoja de ruta' })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta a eliminar', type: Number, example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Hoja de ruta eliminada',
    schema: {
      properties: {
        message: { type: 'string' },
        deleted: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.routeSheetService.remove(id);
  }

  @Post('print')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Generar e imprimir una hoja de ruta',
    description: 'Genera un documento PDF con la hoja de ruta completa y listado de entregas'
  })
  @ApiBody({ type: PrintRouteSheetDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Documento generado correctamente',
    schema: {
      properties: {
        url: { type: 'string' },
        filename: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  print(@Body() printRouteSheetDto: PrintRouteSheetDto) {
    return this.routeSheetService.generatePrintableDocument(
      printRouteSheetDto.route_sheet_id, 
      {
        format: printRouteSheetDto.format,
        includeMap: printRouteSheetDto.include_map,
        includeSignatureField: printRouteSheetDto.include_signature_field,
        includeProductDetails: printRouteSheetDto.include_product_details
      }
    );
  }

  // Endpoints de optimización de rutas

  @Post(':id/optimize')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Optimizar una hoja de ruta',
    description: 'Calcula la ruta óptima para las entregas'
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta a optimizar', type: Number, example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Ruta optimizada correctamente',
    type: RouteOptimizationResponseDto
  })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  optimizeRoute(
    @Param('id', ParseIntPipe) id: number,
    @Body() optimizationDto: CreateRouteOptimizationDto
  ) {
    // Asegurar que el ID en el DTO coincide con el de la ruta
    optimizationDto.route_sheet_id = id;
    return this.routeOptimizationService.optimizeRoute(optimizationDto);
  }

  @Get(':id/optimization')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Obtener la optimización de una hoja de ruta',
    description: 'Devuelve la última optimización calculada para una hoja de ruta'
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta para obtener su optimización', type: Number, example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Optimización encontrada',
    type: RouteOptimizationResponseDto
  })
  @ApiResponse({ status: 404, description: 'No se encontró optimización para la hoja de ruta' })
  getRouteOptimization(@Param('id', ParseIntPipe) id: number) {
    return this.routeOptimizationService.getRouteOptimization(id);
  }

  // Endpoints de inventario móvil

  @Post(':id/inventory')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Inicializar inventario para una hoja de ruta',
    description: 'Registra el inventario inicial cargado en el vehículo'
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta para inicializar inventario', type: Number, example: 1 })
  @ApiResponse({ 
    status: 201, 
    description: 'Inventario inicializado correctamente',
    type: VehicleRouteInventoryResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o inventario ya existente' })
  initializeInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body() inventoryDto: CreateVehicleRouteInventoryDto
  ) {
    // Asegurar que el ID en el DTO coincide con el de la ruta
    inventoryDto.route_sheet_id = id;
    return this.mobileInventoryService.initializeRouteInventory(inventoryDto);
  }

  @Get(':id/inventory')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Obtener el inventario de una hoja de ruta',
    description: 'Muestra el estado actual del inventario en el vehículo'
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta para obtener su inventario', type: Number, example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Inventario encontrado',
    type: VehicleRouteInventoryResponseDto  
  })
  @ApiResponse({ status: 404, description: 'No se encontró inventario para la hoja de ruta' })
  getInventory(@Param('id', ParseIntPipe) id: number) {
    return this.mobileInventoryService.getRouteInventory(id);
  }

  @Post(':id/inventory/transaction')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Registrar una transacción de inventario',
    description: 'Registra entregas, devoluciones o cargas adicionales en el inventario'
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta para la transacción de inventario', type: Number, example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Transacción registrada correctamente',
    type: VehicleRouteInventoryResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o inventario insuficiente' })
  registerInventoryTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() transactionDto: InventoryTransactionDto
  ) {
    // Asegurar que el ID en el DTO coincide con el de la ruta
    transactionDto.route_sheet_id = id;
    return this.mobileInventoryService.registerInventoryTransaction(transactionDto);
  }

  @Get(':id/inventory/alerts')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Verificar alertas de inventario bajo',
    description: 'Chequea si hay productos con inventario insuficiente para completar todas las entregas'
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta para verificar alertas', type: Number, example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Verificación de alertas completada',
    schema: {
      properties: {
        route_sheet_id: { type: 'number' },
        has_alerts: { type: 'boolean' },
        alerts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'number' },
              product_description: { type: 'string' },
              current_quantity: { type: 'number' },
              required_quantity: { type: 'number' },
              shortage: { type: 'number' }
            }
          }
        }
      }
    }
  })
  checkInventoryAlerts(@Param('id', ParseIntPipe) id: number) {
    return this.mobileInventoryService.checkLowInventoryAlerts(id);
  }

  @Post(':id/reconcile-driver')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Registrar la rendición de una hoja de ruta por el chofer',
    description: 'Guarda la firma de conformidad del chofer para la rendición de la hoja de ruta.'
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta a rendir', type: Number, example: 1 })
  @ApiBody({ type: ReconcileRouteSheetDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Rendición registrada exitosamente',
    type: RouteSheetResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o la hoja de ruta ya fue rendida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Hoja de ruta no encontrada' })
  reconcileByDriver(
    @Param('id', ParseIntPipe) id: number,
    @Body() reconcileDto: ReconcileRouteSheetDto
  ) {
    return this.routeSheetService.reconcileRouteSheetByDriver(id, reconcileDto);
  }

  @Post('details/:detailId/payments')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Registrar un pago para una entrega específica de una hoja de ruta',
    description: 'Permite al chofer (o un admin) registrar un pago en efectivo o QR para una entrega.'
  })
  @ApiParam({ name: 'detailId', description: 'ID del detalle de la hoja de ruta para el pago', type: Number, example: 101 })
  @ApiResponse({ status: 201, description: 'Pago registrado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (ej. monto incorrecto, método de pago no válido).' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'Detalle de hoja de ruta, pedido o método de pago no encontrado.' })
  async recordPaymentForDelivery(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body(ValidationPipe) recordPaymentDto: RecordPaymentDto,
    @GetUser() user: User
  ) {
    return this.routeSheetService.recordPaymentForDelivery(detailId, recordPaymentDto, user.id);
  }

  @Put('details/:detailId/skip')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Omitir una entrega (marcar como no entregada por el chofer)' })
  @ApiParam({ name: 'detailId', description: 'ID del detalle de la hoja de ruta', type: 'number' })
  @ApiBody({ type: SkipDeliveryDto })
  @ApiResponse({ status: 200, description: 'Entrega omitida exitosamente.', type: RouteSheetDetailResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o la entrega no se puede omitir.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 404, description: 'Detalle de hoja de ruta no encontrado.' })
  async skipDelivery(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() skipDeliveryDto: SkipDeliveryDto,
    @GetUser('sub') userId: number,
  ) {
    return this.routeSheetService.skipDelivery(detailId, skipDeliveryDto, userId);
  }

  @Post('validate-delivery-times')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({ 
    summary: 'Validar horarios de entrega contra preferencias de suscripción',
    description: 'Valida que los horarios de entrega propuestos respeten las preferencias de horario de los clientes con suscripción'
  })
  @ApiBody({
    description: 'Lista de pedidos con horarios de entrega propuestos',
    type: ValidateDeliveryTimesDto
  })
  @ApiResponse({
    status: 200,
    description: 'Validación completada',
    type: [DeliveryTimeValidationResponseDto]
  })
  async validateDeliveryTimes(@Body() body: ValidateDeliveryTimesDto) {
    const validations: DeliveryTimeValidationResponseDto[] = [];
    
    for (const delivery of body.deliveries) {
      const validation = await this.routeSheetService.validateDeliveryTimeAgainstSubscription(
        delivery.order_id,
        delivery.proposed_delivery_time
      );
      
      // Obtener información adicional del cliente
      const order = await this.routeSheetService.order_header.findUnique({
        where: { order_id: delivery.order_id },
        include: {
          customer: true,
          customer_subscription: {
            include: {
              subscription_delivery_schedule: true
            }
          }
        }
      });
      
      validations.push({
        order_id: delivery.order_id,
        customer_name: order?.customer?.name || 'Cliente desconocido',
        is_valid: validation.isValid,
        message: validation.message,
        suggested_time: validation.suggestedTime,
        preferred_schedules: order?.customer_subscription?.subscription_delivery_schedule || []
      });
    }
    
    return { validations };
  }

  @Patch(':detailId/delivery-time')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar horario de entrega de un detalle de hoja de ruta',
    description: 'Actualiza el horario de entrega de un detalle específico con validación contra las preferencias de suscripción del cliente'
  })
  @ApiParam({
    name: 'detailId',
    description: 'ID del detalle de hoja de ruta',
    example: 1
  })
  @ApiBody({
    description: 'Nuevo horario de entrega',
    type: UpdateDeliveryTimeDto
  })
  @ApiResponse({
    status: 200,
    description: 'Horario de entrega actualizado exitosamente',
    type: RouteSheetDetailResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Horario inválido o datos de entrada incorrectos'
  })
  @ApiResponse({
    status: 404,
    description: 'Detalle de hoja de ruta no encontrado'
  })
  async updateDeliveryTime(
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() updateDeliveryTimeDto: UpdateDeliveryTimeDto
  ) {
    return this.routeSheetService.updateDeliveryTime(detailId, updateDeliveryTimeDto);
  }

  @Post('failed-orders/reassign')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Ejecutar manualmente la reasignación de pedidos fallidos' })
  @ApiResponse({ 
    status: 200, 
    description: 'Reasignación ejecutada exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        reassignedCount: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async forceReassignFailedOrders() {
    const result = await this.failedOrderReassignmentService.reassignFailedOrders();
    return {
      message: 'Reasignación de pedidos fallidos ejecutada exitosamente',
      reassignedCount: result
    };
  }

  @Get('failed-orders/stats')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener estadísticas de pedidos fallidos' })
  @ApiResponse({ 
    status: 200, 
    description: 'Estadísticas de pedidos fallidos',
    schema: {
      type: 'object',
      properties: {
        totalFailed: { type: 'number' },
        pendingReassignment: { type: 'number' },
        reassignedToday: { type: 'number' }
      }
    }
  })
  async getFailedOrderStats() {
    return this.failedOrderReassignmentService.getFailedOrdersStats();
  }
}