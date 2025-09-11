import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserRolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import {
  AutomatedCollectionService,
  CollectionOrderSummaryDto,
} from '../services/automated-collection.service';

export class GenerateCollectionOrdersDto {
  target_date: string; // Formato: YYYY-MM-DD
}

@ApiTags('Automated Collection Orders')
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
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Generar pedidos de cobranza manualmente',
    description:
      'Ejecuta la generación de pedidos de cobranza para una fecha específica. Si la fecha cae en domingo, se ajusta automáticamente al sábado anterior.',
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
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener próximas cobranzas',
    description:
      'Lista los ciclos de suscripción que vencen en los próximos días y requieren generación de pedidos de cobranza.',
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
      'Ejecuta inmediatamente el proceso automático de generación de pedidos de cobranza para la fecha actual.',
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
  @Roles(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Estadísticas de cobranzas automáticas',
    description:
      'Obtiene estadísticas sobre el proceso de generación automática de pedidos de cobranza.',
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
}
