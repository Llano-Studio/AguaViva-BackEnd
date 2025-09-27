import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Auth } from '../../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import {
  MultipleSubscriptionsService,
  MultipleSubscriptionSummaryDto,
  ActiveCycleSummaryDto,
} from '../../common/services/multiple-subscriptions.service';
import { CyclePaymentsService } from '../../cycle-payments/cycle-payments.service';

export class ConsolidatePaymentDto {
  customer_id: number;
  apply_credits_to_debts: boolean;
}

@ApiTags('Multiple Abonos de Clientes')
@ApiBearerAuth()
@Controller('multiple-subscriptions')
export class MultipleSubscriptionsController {
  constructor(
    private readonly multipleSubscriptionsService: MultipleSubscriptionsService,
    private readonly cyclePaymentsService: CyclePaymentsService,
  ) {}

  @Get('customer/:customerId/summary')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary:
      'Obtener resumen consolidado de suscripciones múltiples de un cliente',
    description: `Proporciona una vista consolidada de todas las suscripciones activas de un cliente específico.

## 📊 GESTIÓN DE SUSCRIPCIONES MÚLTIPLES

**Información Consolidada:**
- Todas las suscripciones activas del cliente
- Estado de pagos por cada suscripción
- Balance total de créditos acumulados
- Deudas pendientes consolidadas
- Resumen financiero global

## 💰 ANÁLISIS FINANCIERO

**Métricas Incluidas:**
- Total de ciclos activos
- Monto total pendiente de pago
- Balance total de créditos disponibles
- Distribución de pagos por estado
- Análisis de flujo de caja del cliente

## 🎯 CASOS DE USO

- **Gestión de Cobranzas**: Vista unificada de deudas
- **Aplicación de Créditos**: Identificar oportunidades de compensación
- **Análisis de Cliente**: Evaluación financiera integral
- **Planificación de Entregas**: Coordinación de múltiples servicios`,
  })
  @ApiParam({ name: 'customerId', description: 'ID del cliente', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Resumen de suscripciones obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        customer_id: { type: 'number' },
        customer_name: { type: 'string' },
        active_subscriptions: {
          type: 'array',
          items: { type: 'object' },
        },
        total_active_cycles: { type: 'number' },
        total_pending_amount: { type: 'number' },
        total_credit_balance: { type: 'number' },
        payment_summary: {
          type: 'object',
          properties: {
            total_paid: { type: 'number' },
            total_pending: { type: 'number' },
            total_overdue: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async getCustomerSubscriptionsSummary(
    @Param('customerId', ParseIntPipe) customerId: number,
  ): Promise<MultipleSubscriptionSummaryDto> {
    return this.multipleSubscriptionsService.getCustomerSubscriptionsSummary(
      customerId,
    );
  }

  @Get('customer/:customerId/active-cycles')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener todos los ciclos activos de un cliente',
    description:
      'Lista todos los ciclos de suscripción activos de un cliente con información detallada de pagos',
  })
  @ApiParam({ name: 'customerId', description: 'ID del cliente', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Ciclos activos obtenidos exitosamente',
    type: [Object],
  })
  async getCustomerActiveCycles(
    @Param('customerId', ParseIntPipe) customerId: number,
  ): Promise<ActiveCycleSummaryDto[]> {
    return this.multipleSubscriptionsService.getCustomerActiveCycles(
      customerId,
    );
  }

  @Get('stats')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener estadísticas de múltiples suscripciones',
    description:
      'Proporciona estadísticas consolidadas sobre clientes con múltiples suscripciones y distribución de estados de pago',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        total_customers_with_multiple_subscriptions: { type: 'number' },
        total_active_subscriptions: { type: 'number' },
        total_active_cycles: { type: 'number' },
        average_subscriptions_per_customer: { type: 'number' },
        payment_status_distribution: {
          type: 'object',
          properties: {
            pending: { type: 'number' },
            partial: { type: 'number' },
            paid: { type: 'number' },
            overdue: { type: 'number' },
            credited: { type: 'number' },
          },
        },
      },
    },
  })
  async getMultipleSubscriptionsStats() {
    return this.multipleSubscriptionsService.getMultipleSubscriptionsStats();
  }

  @Get('customer/:customerId/payment-consolidation')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener consolidación de pagos del cliente',
    description:
      'Consolida información de deudas y créditos de todas las suscripciones activas del cliente',
  })
  @ApiParam({ name: 'customerId', description: 'ID del cliente', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Consolidación de pagos obtenida exitosamente',
    schema: {
      type: 'object',
      properties: {
        total_amount_due: { type: 'number' },
        total_credit_available: { type: 'number' },
        net_amount_due: { type: 'number' },
        cycles_with_debt: { type: 'array', items: { type: 'object' } },
        cycles_with_credit: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  async consolidateCustomerPayments(
    @Param('customerId', ParseIntPipe) customerId: number,
  ) {
    return this.multipleSubscriptionsService.consolidateCustomerPayments(
      customerId,
    );
  }

  @Post('customer/:customerId/apply-credits')
  @Auth(Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aplicar créditos a deudas pendientes del cliente',
    description:
      'Aplica automáticamente los créditos acumulados de todas las suscripciones a las deudas pendientes del cliente',
  })
  @ApiParam({ name: 'customerId', description: 'ID del cliente', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Créditos aplicados exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        applied_amount: { type: 'number' },
        remaining_debt: { type: 'number' },
        remaining_credits: { type: 'number' },
      },
    },
  })
  async applyCreditsToCustomerDebts(
    @Param('customerId', ParseIntPipe) customerId: number,
  ) {
    // Obtener todas las suscripciones activas del cliente
    const summary =
      await this.multipleSubscriptionsService.getCustomerSubscriptionsSummary(
        customerId,
      );

    // Aplicar créditos para cada suscripción
    for (const subscription of summary.active_subscriptions) {
      await this.cyclePaymentsService.applyCreditsToOutstandingDebt(
        subscription.subscription_id,
      );
    }

    // Obtener el estado actualizado después de aplicar créditos
    const updatedConsolidation =
      await this.multipleSubscriptionsService.consolidateCustomerPayments(
        customerId,
      );

    return {
      message:
        'Créditos aplicados exitosamente a todas las suscripciones del cliente',
      total_debt_before: summary.total_pending_amount,
      total_credits_before: summary.total_credit_balance,
      remaining_debt: updatedConsolidation.total_amount_due,
      remaining_credits: updatedConsolidation.total_credit_available,
    };
  }

  @Get('customers-with-multiple')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Listar clientes con múltiples suscripciones',
    description:
      'Obtiene una lista de todos los clientes que tienen más de una suscripción activa',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes con múltiples suscripciones',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          customer_id: { type: 'number' },
          customer_name: { type: 'string' },
          subscription_count: { type: 'number' },
          total_pending_amount: { type: 'number' },
          total_credit_balance: { type: 'number' },
        },
      },
    },
  })
  async getCustomersWithMultipleSubscriptions() {
    return this.multipleSubscriptionsService.getCustomersWithMultipleSubscriptions();
  }
}
