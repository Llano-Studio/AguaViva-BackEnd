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

@ApiTags('Generación de Órdenes de Cobranza Manuales')
@Controller('manual-collection')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ManualCollectionController {
  private readonly logger = new Logger(ManualCollectionController.name);

  constructor(
    private readonly manualCollectionService: ManualCollectionService,
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
    summary: 'Generar pedido de cobranza manual',
    description:
      'Genera un nuevo pedido de cobranza manual para los ciclos seleccionados del cliente. Si ya existe un pedido para la fecha, agrega las cobranzas al pedido existente.',
  })
  @ApiResponse({
    status: 201,
    description: 'Pedido de cobranza generado exitosamente',
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
      const result =
        await this.manualCollectionService.generateManualCollection(
          generateDto,
        );

      this.logger.log(
        `✅ Cobranza manual generada exitosamente: Pedido ${result.order_id}, Acción: ${result.action}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error generando cobranza manual para cliente ${generateDto.customer_id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
