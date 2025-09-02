import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../../auth/decorators/auth.decorator';
import { OverdueOrderService } from '../services/overdue-order.service';

@ApiTags('Overdue Orders')
@ApiBearerAuth()
@Controller('overdue-orders')
export class OverdueOrderController {
  constructor(private readonly overdueOrderService: OverdueOrderService) {}

  @Post('mark-overdue')
  @HttpCode(HttpStatus.OK)
  @Auth(Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Marcar pedidos atrasados manualmente',
    description:
      'Ejecuta manualmente el proceso de marcado de pedidos como atrasados (más de 2 días desde su creación)',
  })
  @ApiResponse({
    status: 200,
    description: 'Pedidos marcados como atrasados exitosamente',
    schema: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          description: 'Número de pedidos marcados como atrasados',
        },
        orders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              order_id: { type: 'number' },
              created_at: { type: 'string', format: 'date-time' },
              previous_status: { type: 'string' },
              customer: { type: 'string' },
              days_overdue: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async markOverdueOrdersManually() {
    return await this.overdueOrderService.markOverdueOrdersManually();
  }

  @Get('stats')
  @Auth(Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener estadísticas de pedidos atrasados',
    description:
      'Retorna estadísticas detalladas sobre los pedidos que están marcados como atrasados',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de pedidos atrasados obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        total_overdue: {
          type: 'number',
          description: 'Total de pedidos atrasados',
        },
        by_days: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              days_range: { type: 'string' },
              count: { type: 'number' },
            },
          },
          description: 'Distribución de pedidos atrasados por rangos de días',
        },
        by_status_before_overdue: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              previous_status: { type: 'string' },
              count: { type: 'number' },
            },
          },
          description:
            'Distribución por estado anterior antes de ser marcados como atrasados',
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
  })
  async getOverdueOrdersStats() {
    return await this.overdueOrderService.getOverdueOrdersStats();
  }
}