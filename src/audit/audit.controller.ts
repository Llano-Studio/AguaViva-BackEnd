import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRolesGuard } from '../auth/guards/roles.guard';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuditRecordDto } from '../cycle-payments/dto';

@ApiTags('Auditoría de Pagos')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, UserRolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('payments/:paymentId')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener historial de auditoría de un pago específico',
    description: `Recupera el historial completo de auditoría para un pago específico.

## 📋 HISTORIAL DE AUDITORÍA DE PAGOS

**Funcionalidades:**
- Historial completo de cambios en pagos de ciclos
- Historial completo de cambios en transacciones de pedidos
- Información detallada de cada modificación
- Datos del usuario que realizó cada cambio
- Timestamps precisos de todas las operaciones

**Información Incluida:**
- Valores anteriores y nuevos de cada campo modificado
- Tipo de operación (CREATE, UPDATE, DELETE)
- Usuario responsable del cambio
- Fecha y hora exacta de la modificación
- Dirección IP y User Agent del usuario
- Razón o motivo del cambio

**Casos de Uso:**
- Auditoría de cumplimiento normativo
- Investigación de discrepancias en pagos
- Trazabilidad completa de modificaciones
- Reportes de actividad administrativa`,
  })
  @ApiParam({
    name: 'paymentId',
    description: 'ID del pago para consultar su historial de auditoría',
    type: 'integer',
    example: 123,
  })
  @ApiQuery({
    name: 'table',
    description:
      'Tabla específica a consultar (cycle_payment o payment_transaction)',
    required: false,
    enum: ['cycle_payment', 'payment_transaction'],
    example: 'cycle_payment',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Número máximo de registros a retornar',
    required: false,
    type: 'integer',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial de auditoría recuperado exitosamente',
    schema: {
      type: 'object',
      properties: {
        audit_records: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              audit_id: { type: 'number', example: 1 },
              table_name: { type: 'string', example: 'cycle_payment' },
              record_id: { type: 'number', example: 123 },
              operation_type: { type: 'string', example: 'UPDATE' },
              old_values: {
                type: 'object',
                example: { amount: 15000, payment_method: 'EFECTIVO' },
              },
              new_values: {
                type: 'object',
                example: { amount: 17500, payment_method: 'TRANSFERENCIA' },
              },
              created_at: {
                type: 'string',
                example: '2024-01-15T10:30:00.000Z',
              },
              created_by: { type: 'number', example: 1 },
              reason: {
                type: 'string',
                example: 'Corrección de monto por error de digitación',
              },
              ip_address: { type: 'string', example: '192.168.1.100' },
              user_agent: { type: 'string', example: 'Mozilla/5.0...' },
              user_name: { type: 'string', example: 'Admin Usuario' },
            },
          },
        },
        total_records: { type: 'number', example: 5 },
        payment_info: {
          type: 'object',
          properties: {
            payment_id: { type: 'number', example: 123 },
            current_amount: { type: 'number', example: 17500 },
            current_status: { type: 'string', example: 'ACTIVE' },
            table_type: { type: 'string', example: 'cycle_payment' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para acceder al historial de auditoría',
  })
  @ApiResponse({
    status: 404,
    description: 'Pago no encontrado o sin historial de auditoría',
  })
  async getPaymentAuditHistory(
    @Param('paymentId', ParseIntPipe) paymentId: number,
    @Query('table') tableName?: 'cycle_payment' | 'payment_transaction',
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    // Si no se especifica tabla, intentar determinar automáticamente
    const targetTable = tableName || 'cycle_payment';
    const recordLimit = limit || 50;

    const auditHistory = await this.auditService.getPaymentAuditHistory(
      targetTable,
      paymentId,
      recordLimit,
    );

    return auditHistory;
  }

  @Get('payment-history')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener historial general de auditoría de pagos',
    description: `Recupera el historial general de auditoría de todos los pagos del sistema.

## 📊 HISTORIAL GENERAL DE AUDITORÍA

**Funcionalidades:**
- Listado de todas las operaciones de auditoría de pagos
- Filtrado por tipo de operación y rango de fechas
- Paginación para manejo eficiente de grandes volúmenes
- Búsqueda por usuario responsable
- Ordenamiento por fecha de operación

**Filtros Disponibles:**
- Tipo de operación (CREATE, UPDATE, DELETE)
- Rango de fechas de las operaciones
- Usuario que realizó la operación
- Tabla específica (cycle_payment o payment_transaction)

**Casos de Uso:**
- Reportes de actividad administrativa
- Auditoría de cumplimiento general
- Monitoreo de operaciones del sistema
- Análisis de patrones de modificación`,
  })
  @ApiQuery({
    name: 'operation_type',
    description: 'Filtrar por tipo de operación',
    required: false,
    enum: ['CREATE', 'UPDATE', 'DELETE'],
    example: 'UPDATE',
  })
  @ApiQuery({
    name: 'table_name',
    description: 'Filtrar por tabla específica',
    required: false,
    enum: ['cycle_payment', 'payment_transaction'],
    example: 'cycle_payment',
  })
  @ApiQuery({
    name: 'user_id',
    description: 'Filtrar por usuario que realizó la operación',
    required: false,
    type: 'integer',
    example: 1,
  })
  @ApiQuery({
    name: 'start_date',
    description: 'Fecha de inicio para filtrar registros (ISO 8601)',
    required: false,
    type: 'string',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'end_date',
    description: 'Fecha de fin para filtrar registros (ISO 8601)',
    required: false,
    type: 'string',
    example: '2024-01-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'page',
    description: 'Número de página para paginación',
    required: false,
    type: 'integer',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Número de registros por página',
    required: false,
    type: 'integer',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Historial general de auditoría recuperado exitosamente',
    schema: {
      type: 'object',
      properties: {
        audit_records: {
          type: 'array',
          items: {
            $ref: '#/components/schemas/AuditRecordDto',
          },
        },
        pagination: {
          type: 'object',
          properties: {
            current_page: { type: 'number', example: 1 },
            total_pages: { type: 'number', example: 10 },
            total_records: { type: 'number', example: 200 },
            records_per_page: { type: 'number', example: 20 },
          },
        },
        filters_applied: {
          type: 'object',
          properties: {
            operation_type: { type: 'string', example: 'UPDATE' },
            table_name: { type: 'string', example: 'cycle_payment' },
            date_range: {
              type: 'object',
              properties: {
                start: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
                end: { type: 'string', example: '2024-01-31T23:59:59.999Z' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Sin permisos para acceder al historial general de auditoría',
  })
  async getGeneralPaymentAuditHistory(
    @Query('operation_type') operationType?: 'CREATE' | 'UPDATE' | 'DELETE',
    @Query('table_name') tableName?: 'cycle_payment' | 'payment_transaction',
    @Query('user_id', new ParseIntPipe({ optional: true })) userId?: number,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    const currentPage = page || 1;
    const recordsPerPage = limit || 20;
    const offset = (currentPage - 1) * recordsPerPage;

    const filters = {
      operationType,
      tableName,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const result = await this.auditService.getGeneralAuditHistory(
      filters,
      recordsPerPage,
      offset,
    );

    return {
      audit_records: result.records,
      pagination: {
        current_page: currentPage,
        total_pages: Math.ceil(result.total / recordsPerPage),
        total_records: result.total,
        records_per_page: recordsPerPage,
      },
      filters_applied: {
        operation_type: operationType,
        table_name: tableName,
        user_id: userId,
        date_range:
          startDate && endDate
            ? {
                start: startDate,
                end: endDate,
              }
            : null,
      },
    };
  }

  @Get('statistics')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas de auditoría de pagos',
    description: `Proporciona estadísticas resumidas sobre las operaciones de auditoría de pagos.

## 📈 ESTADÍSTICAS DE AUDITORÍA

**Métricas Incluidas:**
- Total de operaciones por tipo (CREATE, UPDATE, DELETE)
- Actividad por usuario en período específico
- Distribución de operaciones por tabla
- Tendencias de modificaciones por día/semana/mes
- Usuarios más activos en modificaciones

**Casos de Uso:**
- Dashboards administrativos
- Reportes ejecutivos de actividad
- Monitoreo de patrones de uso
- Identificación de usuarios con alta actividad`,
  })
  @ApiQuery({
    name: 'period',
    description: 'Período para las estadísticas',
    required: false,
    enum: ['day', 'week', 'month', 'year'],
    example: 'month',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de auditoría recuperadas exitosamente',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            total_operations: { type: 'number', example: 150 },
            operations_by_type: {
              type: 'object',
              properties: {
                CREATE: { type: 'number', example: 50 },
                UPDATE: { type: 'number', example: 80 },
                DELETE: { type: 'number', example: 20 },
              },
            },
            operations_by_table: {
              type: 'object',
              properties: {
                cycle_payment: { type: 'number', example: 90 },
                payment_transaction: { type: 'number', example: 60 },
              },
            },
          },
        },
        top_users: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              user_id: { type: 'number', example: 1 },
              user_name: { type: 'string', example: 'Admin Usuario' },
              operation_count: { type: 'number', example: 25 },
            },
          },
        },
        daily_activity: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2024-01-15' },
              operation_count: { type: 'number', example: 12 },
            },
          },
        },
      },
    },
  })
  async getAuditStatistics(
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.auditService.getAuditStatistics(period);
  }
}
