import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ManualCollectionService } from '../../common/services/manual-collection.service';
import { AutomatedCollectionService } from '../../common/services/automated-collection.service';
import {
  CustomerSearchDto,
  CustomerSearchResponseDto,
} from '../dto/customer-search.dto';
import { PendingCyclesResponseDto } from '../dto/pending-cycles.dto';
import {
  GenerateManualCollectionDto,
  GenerateManualCollectionResponseDto,
  ExistingOrderResponseDto,
} from '../dto/generate-manual-collection.dto';
import { Role } from '@prisma/client';
import { Auth } from '../../auth/decorators/auth.decorator';

@ApiTags('Generación de Órdenes de Cobranza Manuales')
@Controller('manual-collection')
@UseGuards(JwtAuthGuard)
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
@ApiBearerAuth()
export class ManualCollectionController {
  private readonly logger = new Logger(ManualCollectionController.name);

  constructor(
    private readonly manualCollectionService: ManualCollectionService,
    private readonly automatedCollectionService: AutomatedCollectionService,
  ) {}

  @Get('customers/search')
  @ApiOperation({
    summary: 'Buscar clientes con ciclos de suscripción pendientes de cobro',
    description: `Busca clientes que tengan suscripciones activas con ciclos pendientes de pago para generar órdenes de cobranza manual.

## 🔍 BÚSQUEDA AVANZADA DE CLIENTES

**Criterios de Búsqueda:**
- Clientes con suscripciones activas
- Ciclos con saldo pendiente de pago
- Filtrado por ubicación geográfica
- Búsqueda por datos personales

## 📊 FILTROS DISPONIBLES

**Búsqueda de Texto:**
- Nombre del cliente (búsqueda parcial)
- Número de teléfono
- ID específico del cliente

**Filtros Geográficos:**
- Por zona de entrega
- Por localidad específica
- Útil para planificación de rutas de cobranza

## 🎯 CASOS DE USO

- **Cobranza Selectiva**: Identificar clientes con deudas
- **Planificación Geográfica**: Agrupar cobranzas por zona
- **Gestión de Cartera**: Priorizar clientes por saldo pendiente`,
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Texto de búsqueda (nombre, teléfono o ID del cliente)',
    example: 'Juan Pérez',
  })
  @ApiQuery({
    name: 'zone_id',
    required: false,
    description: 'ID de la zona para filtrar',
    example: 1,
  })
  @ApiQuery({
    name: 'locality_id',
    required: false,
    description: 'ID de la localidad para filtrar',
    example: 1,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página (por defecto: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Cantidad de resultados por página (por defecto: 10)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes encontrados',
    type: CustomerSearchResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async searchCustomers(
    @Query() searchParams: CustomerSearchDto,
  ): Promise<CustomerSearchResponseDto> {
    this.logger.log(`🔍 Búsqueda de clientes: ${JSON.stringify(searchParams)}`);

    try {
      const result =
        await this.manualCollectionService.searchCustomers(searchParams);

      this.logger.log(
        `✅ Búsqueda completada: ${result.customers.length} clientes encontrados`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error en búsqueda de clientes: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('customers/:customerId/pending-cycles')
  @ApiOperation({
    summary: 'Obtener ciclos pendientes de un cliente',
    description:
      'Obtiene todos los ciclos con saldo pendiente de un cliente específico, incluyendo información detallada de cada ciclo.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'ID del cliente',
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Información del cliente y sus ciclos pendientes',
    type: PendingCyclesResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado o inactivo',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async getCustomerPendingCycles(
    @Param('customerId', ParseIntPipe) customerId: number,
  ): Promise<PendingCyclesResponseDto> {
    this.logger.log(
      `📋 Obteniendo ciclos pendientes para cliente ID: ${customerId}`,
    );

    try {
      const result =
        await this.manualCollectionService.getCustomerPendingCycles(customerId);

      this.logger.log(
        `✅ Ciclos pendientes obtenidos: ${result.pending_cycles.length} ciclos, total: $${result.total_pending}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error obteniendo ciclos pendientes para cliente ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('customers/:customerId/existing-order')
  @ApiOperation({
    summary: 'Verificar pedido existente para una fecha',
    description:
      'Verifica si el cliente ya tiene un pedido activo (PENDING, CONFIRMED, IN_PREPARATION) para la fecha especificada.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'ID del cliente',
    example: 123,
  })
  @ApiQuery({
    name: 'date',
    description: 'Fecha a verificar (formato YYYY-MM-DD)',
    example: '2024-01-15',
  })
  @ApiResponse({
    status: 200,
    description: 'Información sobre pedido existente',
    type: ExistingOrderResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Fecha inválida',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async checkExistingOrder(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query('date') date: string,
  ): Promise<ExistingOrderResponseDto> {
    this.logger.log(
      `🔍 Verificando pedido existente para cliente ${customerId} en fecha ${date}`,
    );

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      this.logger.error(`❌ Formato de fecha inválido: ${date}`);
      throw new Error('Formato de fecha inválido. Use YYYY-MM-DD');
    }

    try {
      const result = await this.manualCollectionService.checkExistingOrder(
        customerId,
        date,
      );

      this.logger.log(
        `✅ Verificación completada: ${result.has_existing_order ? 'Pedido existente encontrado' : 'No hay pedido existente'}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error verificando pedido existente para cliente ${customerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generar orden de cobranza manual',
    description: `Genera una nueva orden de cobranza manual en la tabla collection_orders con es_automatica=false.

## 🆕 NUEVA FUNCIONALIDAD - COLLECTION_ORDERS

**Características Principales:**
- Crea órdenes en la tabla collection_orders (no en order_header)
- Marca automáticamente es_automatica=false para órdenes manuales
- Opcionalmente crea un pedido híbrido asociado
- Previene la creación automática de órdenes para el mismo ciclo

## 🔧 LÓGICA DE CONTROL

**Validaciones:**
- Verifica que cada ciclo exista y tenga saldo pendiente
- Previene duplicación de órdenes para el mismo ciclo
- Valida que la fecha de cobranza sea válida

**Creación de Pedido Híbrido:**
- Se crea automáticamente para cobranzas manuales
- Solo aplica a órdenes manuales (no automáticas)
- Permite entrega de productos junto con la cobranza

## 🚫 PREVENCIÓN DE DUPLICADOS

**Control Automático:**
- Si un ciclo ya tiene una orden manual, no se genera una automática
- El sistema verifica la existencia antes de crear nuevas órdenes
- Mantiene la integridad entre órdenes manuales y automáticas`,
  })
  @ApiResponse({
    status: 201,
    description: 'Orden de cobranza manual generada exitosamente',
    type: GenerateManualCollectionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o ciclos no válidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Ya existe una orden de cobranza para algún ciclo',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async generateManualCollection(
    @Body(ValidationPipe) generateDto: GenerateManualCollectionDto,
  ): Promise<GenerateManualCollectionResponseDto> {
    this.logger.log(
      `🚀 Generando cobranza manual para cliente ${generateDto.customer_id}`,
    );
    this.logger.log(
      `📊 Ciclos seleccionados: ${generateDto.selected_cycles.length}, Fecha: ${generateDto.collection_date}`,
    );

    try {
      // Validar y parsear la fecha
      const collectionDate = new Date(generateDto.collection_date);
      if (isNaN(collectionDate.getTime())) {
        throw new Error('Fecha de cobranza inválida. Use formato YYYY-MM-DD');
      }

      const results = [];
      let totalAmount = 0;
      let cyclesProcessed = 0;
      let lastOrderId = 0;

      // Procesar cada ciclo seleccionado
      for (const cycleId of generateDto.selected_cycles) {
        try {
          // Verificar si ya existe una orden de cobranza para este ciclo
          const hasExistingOrder =
            await this.automatedCollectionService.hasCollectionOrderForCycle(
              cycleId,
            );

          if (hasExistingOrder) {
            this.logger.warn(
              `⚠️ Saltando ciclo ${cycleId} - ya tiene una orden de cobranza`,
            );
            continue;
          }

          // Generar la orden de cobranza manual con pedido híbrido
          const result =
            await this.automatedCollectionService.generateManualCollectionOrder(
              cycleId,
              collectionDate,
              true, // createHybridOrder = true para cobranzas manuales
            );

          results.push(result);
          totalAmount += result.pending_balance;
          cyclesProcessed++;
          lastOrderId = result.order_id;

          this.logger.log(
            `✅ Orden de cobranza manual creada para ciclo ${cycleId}: ID ${result.order_id}`,
          );
        } catch (error) {
          this.logger.error(
            `❌ Error procesando ciclo ${cycleId}: ${error.message}`,
          );
          // Continuar con los demás ciclos
        }
      }

      if (cyclesProcessed === 0) {
        throw new Error(
          'No se pudo procesar ningún ciclo. Verifique que los ciclos sean válidos y no tengan órdenes existentes.',
        );
      }

      const response: GenerateManualCollectionResponseDto = {
        success: true,
        order_id: lastOrderId,
        action: 'created',
        total_amount: totalAmount,
        cycles_processed: cyclesProcessed,
        message: `${cyclesProcessed} orden(es) de cobranza manual generada(s) exitosamente con pedidos híbridos`,
      };

      this.logger.log(
        `✅ Cobranza manual completada: ${cyclesProcessed} ciclos procesados, Total: $${totalAmount}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `❌ Error generando cobranza manual para cliente ${generateDto.customer_id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
