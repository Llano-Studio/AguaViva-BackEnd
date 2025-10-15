import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpStatus,
  HttpException,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
  ApiProperty,
  ApiParam,
} from '@nestjs/swagger';
import { IsDateString, IsNotEmpty } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AutomatedCollectionService } from '../../common/services/automated-collection.service';
import { FilterAutomatedCollectionsDto } from '../dto/filter-automated-collections.dto';
import { AutomatedCollectionListResponseDto } from '../dto/automated-collection-response.dto';
import { GeneratePdfCollectionsDto, PdfGenerationResponseDto } from '../dto/generate-pdf-collections.dto';
import { GenerateRouteSheetDto, RouteSheetResponseDto } from '../dto/generate-route-sheet.dto';
import { DeleteAutomatedCollectionResponseDto } from '../dto/delete-automated-collection.dto';

export class GenerateCollectionOrdersDto {
  @ApiProperty({
    description:
      'Fecha objetivo para generar las órdenes de cobranza en formato YYYY-MM-DD. Si la fecha cae en domingo, se ajusta automáticamente al sábado anterior.',
    example: '2024-01-15',
    type: String,
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsNotEmpty({ message: 'La fecha objetivo es requerida' })
  @IsDateString(
    {},
    { message: 'La fecha debe estar en formato YYYY-MM-DD válido' },
  )
  target_date: string;
}

@ApiTags('Generación de Órdenes de Cobranza')
@Controller('automated-collection')
@UseGuards(JwtAuthGuard, UserRolesGuard)
@ApiBearerAuth()
export class AutomatedCollectionController {
  constructor(
    private readonly automatedCollectionService: AutomatedCollectionService,
  ) {}

  /**
   * Ejecuta manualmente la generación de pedidos de cobranza para una fecha específica
   */
  @Post('generate')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Generar pedidos de cobranza automática para fecha específica',
    description: `Ejecuta manualmente el proceso de generación automática de pedidos de cobranza para una fecha específica.

## 🤖 GENERACIÓN AUTOMÁTICA DE COBRANZAS

**Proceso Automatizado:**
- Identifica ciclos de suscripción con vencimiento en la fecha objetivo
- Genera automáticamente órdenes de cobranza
- Ajusta fechas de domingo a sábado anterior
- Consolida múltiples ciclos del mismo cliente
- Aplica reglas de negocio automáticamente

## 📅 LÓGICA DE FECHAS

**Ajustes Automáticos:**
- Si la fecha objetivo es domingo → se ajusta al sábado anterior
- Respeta días hábiles para cobranzas
- Mantiene consistencia en el calendario de cobranzas

## 🎯 CASOS DE USO

- **Procesamiento Fuera de Horario**: Ejecutar cobranzas manualmente
- **Recuperación de Procesos**: Reprocesar fechas específicas
- **Testing y Validación**: Verificar generación para fechas futuras
- **Ajustes de Calendario**: Procesar días festivos o excepciones`,
  })
  @ApiBody({ type: GenerateCollectionOrdersDto })
  @ApiResponse({
    status: 200,
    description: 'Pedidos de cobranza generados exitosamente',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            target_date: { type: 'string' },
            total_cycles: { type: 'number' },
            orders_created: { type: 'number' },
            orders_updated: { type: 'number' },
            errors: { type: 'number' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cycle_id: { type: 'number' },
                  subscription_id: { type: 'number' },
                  customer_id: { type: 'number' },
                  customer_name: { type: 'string' },
                  subscription_plan_name: { type: 'string' },
                  payment_due_date: { type: 'string' },
                  pending_balance: { type: 'number' },
                  order_created: { type: 'boolean' },
                  order_id: { type: 'number' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Fecha inválida' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes' })
  async generateCollectionOrders(@Body() dto: GenerateCollectionOrdersDto) {
    try {
      // Validar formato de fecha
      const targetDate = new Date(dto.target_date);
      if (isNaN(targetDate.getTime())) {
        throw new HttpException(
          'Formato de fecha inválido. Use YYYY-MM-DD',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Ejecutar generación
      const results =
        await this.automatedCollectionService.generateCollectionOrdersForDate(
          targetDate,
        );

      // Calcular estadísticas
      const totalCycles = results.length;
      const ordersCreated = results.filter(
        (r) => r.order_created && r.notes?.includes('Nuevo pedido'),
      ).length;
      const ordersUpdated = results.filter(
        (r) => r.order_created && r.notes?.includes('actualizado'),
      ).length;
      const errors = results.filter((r) => !r.order_created).length;

      return {
        success: true,
        message: `Generación completada: ${ordersCreated + ordersUpdated}/${totalCycles} pedidos procesados`,
        data: {
          target_date: dto.target_date,
          total_cycles: totalCycles,
          orders_created: ordersCreated,
          orders_updated: ordersUpdated,
          errors: errors,
          results: results,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Error generando pedidos de cobranza: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene los próximos ciclos que requieren cobranza
   */
  @Get('upcoming')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener próximas cobranzas',
    description: `Obtiene una lista detallada de los ciclos de suscripción que vencen en los próximos días y requieren generación de pedidos de cobranza.

## 📊 INFORMACIÓN INCLUIDA

**Datos del Ciclo:**
- ID del ciclo y suscripción asociada
- Información completa del cliente
- Detalles del plan de suscripción
- Fecha de vencimiento del pago
- Saldo pendiente por cobrar

**Estado de Procesamiento:**
- Indicador si ya se generó orden de cobranza
- ID de orden generada (si existe)
- Notas y observaciones del proceso

## 📈 MÉTRICAS AGREGADAS

**Resumen del Período:**
- Total de cobranzas próximas
- Monto total a cobrar
- Período de días consultado
- Distribución temporal de vencimientos

## 🎯 CASOS DE USO

- **Planificación de Cobranzas**: Anticipar volumen de trabajo
- **Gestión de Flujo de Caja**: Proyección de ingresos
- **Seguimiento Operativo**: Monitoreo de ciclos pendientes
- **Análisis de Tendencias**: Patrones de vencimientos
- **Preparación de Rutas**: Organización de cobranzas por zona`,
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Número de días a consultar (por defecto: 7)',
    example: 7,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de próximas cobranzas',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            period_days: { type: 'number' },
            total_upcoming: { type: 'number' },
            total_amount: { type: 'number' },
            upcoming_collections: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cycle_id: { type: 'number' },
                  subscription_id: { type: 'number' },
                  customer_id: { type: 'number' },
                  customer_name: { type: 'string' },
                  subscription_plan_name: { type: 'string' },
                  payment_due_date: { type: 'string' },
                  pending_balance: { type: 'number' },
                  order_created: { type: 'boolean' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  async getUpcomingCollections(@Query('days') days?: number) {
    try {
      const periodDays = days && days > 0 ? Math.min(days, 30) : 7; // Máximo 30 días
      const upcomingCollections =
        await this.automatedCollectionService.getUpcomingCollections(
          periodDays,
        );

      const totalAmount = upcomingCollections.reduce(
        (sum, collection) => sum + collection.pending_balance,
        0,
      );

      return {
        success: true,
        message: `${upcomingCollections.length} cobranzas próximas en los siguientes ${periodDays} días`,
        data: {
          period_days: periodDays,
          total_upcoming: upcomingCollections.length,
          total_amount: totalAmount,
          upcoming_collections: upcomingCollections,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Error obteniendo próximas cobranzas: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Ejecuta inmediatamente la generación automática de pedidos para hoy
   */
  @Post('run-today')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Ejecutar generación automática para hoy',
    description:
      'Ejecuta inmediatamente el proceso automático de generación de pedidos de cobranza para la fecha actual. No requiere parámetros en el cuerpo de la solicitud.',
  })
  @ApiBody({
    required: false,
    description:
      'Este endpoint no requiere cuerpo de solicitud. Se ejecuta para la fecha actual automáticamente.',
    schema: {
      type: 'object',
      properties: {},
      example: {},
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Generación automática ejecutada',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            execution_date: { type: 'string' },
            total_processed: { type: 'number' },
            successful: { type: 'number' },
            failed: { type: 'number' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  cycle_id: { type: 'number' },
                  subscription_id: { type: 'number' },
                  customer_id: { type: 'number' },
                  customer_name: { type: 'string' },
                  subscription_plan_name: { type: 'string' },
                  payment_due_date: { type: 'string' },
                  pending_balance: { type: 'number' },
                  order_created: { type: 'boolean' },
                  order_id: { type: 'number' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  async runTodayGeneration() {
    try {
      const results =
        await this.automatedCollectionService.generateCollectionOrders();

      const totalProcessed = results.length;
      const successful = results.filter((r) => r.order_created).length;
      const failed = results.filter((r) => !r.order_created).length;

      return {
        success: true,
        message: `Generación automática completada: ${successful}/${totalProcessed} pedidos procesados exitosamente`,
        data: {
          execution_date: new Date().toISOString().split('T')[0],
          total_processed: totalProcessed,
          successful: successful,
          failed: failed,
          results: results,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Error ejecutando generación automática: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene estadísticas de la generación automática de cobranzas
   */
  @Get('stats')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Estadísticas de cobranzas automáticas',
    description: `Proporciona estadísticas detalladas y métricas clave sobre el proceso de generación automática de pedidos de cobranza.

## 📊 MÉTRICAS PRINCIPALES

**Ciclos de Facturación:**
- **total_cycles_due**: Total de ciclos con vencimiento en el período
- **overdue_cycles**: Ciclos vencidos que requieren atención inmediata
- **upcoming_this_week**: Ciclos que vencen en la semana actual
- **upcoming_next_week**: Ciclos que vencen en la próxima semana

**Montos Financieros:**
- **total_pending_amount**: Monto total pendiente de cobro
- **overdue_amount**: Monto total de ciclos vencidos
- Proyección de ingresos por período

## 📈 ANÁLISIS TEMPORAL

**Distribución de Vencimientos:**
- Análisis de tendencias semanales
- Identificación de picos de cobranza
- Planificación de recursos operativos
- Proyección de flujo de caja

## 🎯 CASOS DE USO

- **Dashboard Ejecutivo**: Métricas clave para toma de decisiones
- **Planificación Operativa**: Asignación de recursos de cobranza
- **Análisis Financiero**: Proyección de ingresos y flujo de caja
- **Gestión de Riesgos**: Identificación de ciclos vencidos
- **Reportes Gerenciales**: KPIs del proceso de cobranza
- **Optimización de Procesos**: Análisis de eficiencia operativa`,
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Período en días para las estadísticas (por defecto: 30)',
    example: 30,
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de cobranzas automáticas',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            period_days: { type: 'number' },
            total_cycles_due: { type: 'number' },
            total_pending_amount: { type: 'number' },
            overdue_cycles: { type: 'number' },
            overdue_amount: { type: 'number' },
            upcoming_this_week: { type: 'number' },
            upcoming_next_week: { type: 'number' },
          },
        },
      },
    },
  })
  async getCollectionStats(@Query('days') days?: number) {
    try {
      const periodDays = days && days > 0 ? Math.min(days, 90) : 30; // Máximo 90 días

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setDate(today.getDate() + periodDays);

      // Obtener ciclos con vencimiento en el período
      const cyclesDue =
        await this.automatedCollectionService['getCyclesDueForCollection'](
          today,
        );

      // Obtener próximas cobranzas para estadísticas
      const upcomingThisWeek =
        await this.automatedCollectionService.getUpcomingCollections(7);
      const upcomingNextWeek =
        await this.automatedCollectionService.getUpcomingCollections(14);

      const totalPendingAmount = cyclesDue.reduce(
        (sum, cycle) => sum + Number(cycle.pending_balance),
        0,
      );
      const overdueCycles = cyclesDue.filter(
        (cycle) => cycle.payment_due_date && cycle.payment_due_date < today,
      );
      const overdueAmount = overdueCycles.reduce(
        (sum, cycle) => sum + Number(cycle.pending_balance),
        0,
      );

      return {
        success: true,
        message: `Estadísticas de cobranzas para los próximos ${periodDays} días`,
        data: {
          period_days: periodDays,
          total_cycles_due: cyclesDue.length,
          total_pending_amount: totalPendingAmount,
          overdue_cycles: overdueCycles.length,
          overdue_amount: overdueAmount,
          upcoming_this_week: upcomingThisWeek.length,
          upcoming_next_week: upcomingNextWeek.length - upcomingThisWeek.length,
        },
      };
    } catch (error) {
      throw new HttpException(
        `Error obteniendo estadísticas: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lista las órdenes de cobranza automática con filtros y paginación
   */
  @Get('orders')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Listar órdenes de cobranza automática',
    description: `Obtiene una lista paginada de órdenes de cobranza automática con capacidades avanzadas de filtrado.

## 🔍 FILTROS DISPONIBLES

**Filtros Temporales:**
- **search**: Búsqueda por texto en nombre de cliente o notas
- **orderDateFrom/orderDateTo**: Rango de fechas de creación de orden
- **dueDateFrom/dueDateTo**: Rango de fechas de vencimiento
- **overdue**: Solo órdenes vencidas (true/false)

**Filtros de Estado:**
- **statuses**: Estados de la orden (PENDING, PROCESSING, DELIVERED, etc.)
- **paymentStatuses**: Estados de pago (PENDING, PARTIAL, PAID, OVERDUE)

**Filtros de Cliente:**
- **customerName**: Nombre del cliente
- **customerIds**: IDs específicos de clientes
- **zoneIds**: IDs de zonas geográficas

**Filtros Financieros:**
- **minAmount/maxAmount**: Rango de montos
- **subscriptionPlanId**: Plan de suscripción específico

## 📊 RESPUESTA INCLUYE

**Datos de la Orden:**
- Información completa de la orden de cobranza
- Detalles del cliente y suscripción
- Estado de pago y montos
- Fechas de vencimiento y creación

**Metadatos:**
- Información de paginación
- Totales y resúmenes
- Estadísticas del conjunto filtrado`,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de órdenes de cobranza automática',
    type: AutomatedCollectionListResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes' })
  async listAutomatedCollections(@Query() filters: FilterAutomatedCollectionsDto) {
    try {
      const result = await this.automatedCollectionService.listAutomatedCollections(filters);
      return {
        success: true,
        message: `${result.data.length} órdenes de cobranza encontradas`,
        ...result,
      };
    } catch (error) {
      throw new HttpException(
        `Error obteniendo órdenes de cobranza: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene los detalles de una orden de cobranza automática específica
   */
  @Get('orders/:id')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Obtener detalles de orden de cobranza',
    description: `Obtiene información detallada de una orden de cobranza automática específica.

## 📋 INFORMACIÓN INCLUIDA

**Datos de la Orden:**
- Información completa de la orden
- Estado actual y historial
- Montos y fechas importantes
- Notas y observaciones

**Información del Cliente:**
- Datos completos del cliente
- Información de contacto
- Ubicación y zona

**Detalles de Suscripción:**
- Plan de suscripción asociado
- Ciclo de facturación
- Historial de pagos

**Metadatos Operativos:**
- Fechas de creación y modificación
- Usuario responsable
- Trazabilidad del proceso`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de cobranza automática',
    type: Number,
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Detalles de la orden de cobranza',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          $ref: '#/components/schemas/AutomatedCollectionResponseDto',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Orden de cobranza no encontrada' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes' })
  async getAutomatedCollectionById(@Param('id', ParseIntPipe) id: number) {
    try {
      const collection = await this.automatedCollectionService.getAutomatedCollectionById(id);
      return {
        success: true,
        message: 'Orden de cobranza encontrada',
        data: collection,
      };
    } catch (error) {
      if (error.message.includes('no encontrada')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        `Error obteniendo orden de cobranza: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Elimina lógicamente una orden de cobranza automática
   */
  @Delete('orders/:id')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Eliminar orden de cobranza automática',
    description: `Realiza una eliminación lógica de una orden de cobranza automática.

## ⚠️ VALIDACIONES DE SEGURIDAD

**Restricciones de Eliminación:**
- No se puede eliminar si existen pagos registrados
- Solo eliminación lógica (soft delete)
- Requiere permisos administrativos
- Se mantiene trazabilidad completa

**Proceso de Eliminación:**
- Marca la orden como eliminada
- Preserva datos para auditoría
- Actualiza estados relacionados
- Registra información de eliminación

## 📊 INFORMACIÓN DE RESPUESTA

**Confirmación:**
- Estado de éxito de la operación
- ID de la orden eliminada
- Timestamp de eliminación
- Información adicional del proceso

**Metadatos:**
- Tipo de eliminación (lógica)
- Estado de pago previo
- Monto pendiente
- Nombre del cliente afectado`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la orden de cobranza a eliminar',
    type: Number,
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Orden de cobranza eliminada exitosamente',
    type: DeleteAutomatedCollectionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Orden de cobranza no encontrada' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar: existen pagos registrados' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes' })
  async deleteAutomatedCollection(@Param('id', ParseIntPipe) id: number) {
    try {
      const result = await this.automatedCollectionService.deleteAutomatedCollection(id);
      return {
        success: true,
        message: 'Orden de cobranza eliminada exitosamente',
        ...result,
      };
    } catch (error) {
      if (error.message.includes('no encontrada')) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      if (error.message.includes('pagos registrados')) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(
        `Error eliminando orden de cobranza: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Genera un reporte PDF de órdenes de cobranza automática
   */
  @Post('orders/generate-pdf')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Generar reporte PDF de cobranzas',
    description: `Genera un reporte PDF personalizado de órdenes de cobranza automática con filtros avanzados.

## 📄 CARACTERÍSTICAS DEL PDF

**Contenido del Reporte:**
- Resumen ejecutivo con totales
- Lista detallada de órdenes filtradas
- Información de cliente y suscripción
- Estados de pago y montos
- Fechas de vencimiento y creación

**Formatos Disponibles:**
- **summary**: Reporte resumido con totales
- **detailed**: Reporte detallado con toda la información
- **executive**: Reporte ejecutivo para gerencia

**Filtros Aplicables:**
- Rangos de fechas personalizables
- Estados de orden y pago
- Clientes y zonas específicas
- Montos mínimos y máximos
- Solo órdenes vencidas

## 📊 METADATOS DEL ARCHIVO

**Información del PDF:**
- URL de descarga temporal
- Nombre del archivo generado
- Tamaño del archivo
- Fecha de generación
- Tiempo de expiración

**Estadísticas del Reporte:**
- Total de órdenes incluidas
- Monto total del reporte
- Distribución por estados
- Resumen de vencimientos`,
  })
  @ApiBody({ type: GeneratePdfCollectionsDto })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    type: PdfGenerationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Parámetros de filtro inválidos' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes' })
  async generatePdfReport(@Body() filters: GeneratePdfCollectionsDto) {
    try {
      const result = await this.automatedCollectionService.generatePdfReport(filters);
      return {
        success: true,
        message: 'Reporte PDF generado exitosamente',
        ...result,
      };
    } catch (error) {
      throw new HttpException(
        `Error generando reporte PDF: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Genera una hoja de ruta para cobranzas automáticas
   */
  @Post('orders/route-sheet')
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
  @ApiOperation({
    summary: 'Generar hoja de ruta de cobranzas',
    description: `Genera una hoja de ruta optimizada para la recolección de cobranzas automáticas.

## 🗺️ CARACTERÍSTICAS DE LA RUTA

**Organización Geográfica:**
- Agrupación automática por zonas
- Optimización de recorridos
- Información de ubicaciones
- Distancias estimadas

**Información del Conductor:**
- Datos del conductor asignado
- Información del vehículo
- Capacidad de carga
- Horarios de trabajo

**Detalles de Cobranza:**
- Lista de clientes a visitar
- Montos a cobrar por cliente
- Estados de pago actuales
- Información de contacto

## 📋 FORMATOS DISPONIBLES

**Tipos de Hoja de Ruta:**
- **standard**: Formato estándar para conductores
- **detailed**: Formato detallado con toda la información
- **compact**: Formato compacto para dispositivos móviles

**Ordenamiento:**
- **zone**: Por zona geográfica
- **amount**: Por monto descendente
- **priority**: Por prioridad de cobranza
- **customer**: Por nombre de cliente

## 📊 INFORMACIÓN ADICIONAL

**Resumen de la Ruta:**
- Total de paradas programadas
- Monto total a cobrar
- Tiempo estimado de recorrido
- Zonas a cubrir

**Metadatos Operativos:**
- Fecha de generación
- Conductor asignado
- Vehículo asignado
- Notas especiales`,
  })
  @ApiBody({ type: GenerateRouteSheetDto })
  @ApiResponse({
    status: 200,
    description: 'Hoja de ruta generada exitosamente',
    type: RouteSheetResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Parámetros de filtro inválidos' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes' })
  async generateRouteSheet(@Body() filters: GenerateRouteSheetDto) {
    try {
      const result = await this.automatedCollectionService.generateRouteSheet(filters);
      return {
        success: true,
        message: 'Hoja de ruta generada exitosamente',
        ...result,
      };
    } catch (error) {
      throw new HttpException(
        `Error generando hoja de ruta: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
