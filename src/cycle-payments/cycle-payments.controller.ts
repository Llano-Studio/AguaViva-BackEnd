import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { CyclePaymentsService } from './cycle-payments.service';
import { CreateCyclePaymentDto } from './dto/create-cycle-payment.dto';
import {
  CyclePaymentResponseDto,
  CyclePaymentSummaryDto,
} from './dto/cycle-payment-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRolesGuard } from '../auth/guards/roles.guard';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { SubscriptionCycleCalculatorService } from '../common/services/subscription-cycle-calculator.service';

@ApiTags('Pagos de Ciclos')
@ApiBearerAuth()
@Controller('cycle-payments')
@UseGuards(JwtAuthGuard, UserRolesGuard)
export class CyclePaymentsController {
  constructor(
    private readonly cyclePaymentsService: CyclePaymentsService,
    private readonly cycleCalculatorService: SubscriptionCycleCalculatorService,
  ) {}

  @Post()
  @Auth(Role.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar pago de ciclo de suscripción',
    description: `Registra un pago para un ciclo de suscripción específico con cálculo automático de recargos por mora.

## 💰 GESTIÓN DE PAGOS DE CICLOS

**Funcionalidades Principales:**
- Registro de pagos parciales o completos
- Cálculo automático de recargos por mora
- Validación de montos contra saldo pendiente
- Actualización automática del estado del ciclo
- Registro de método de pago utilizado

## 📊 CASOS DE USO

**Tipos de Pago:**
- **Pago Completo**: Salda completamente el ciclo
- **Pago Parcial**: Abona parte del saldo pendiente
- **Pago con Mora**: Incluye recargos por vencimiento

**Métodos de Pago Soportados:**
- Efectivo
- Transferencia bancaria
- QR/Billetera digital
- Tarjeta de crédito/débito

## ⚠️ VALIDACIONES AUTOMÁTICAS

- El monto no puede exceder el saldo pendiente
- Se calculan recargos por mora automáticamente
- Se valida la existencia del ciclo de suscripción
- Se registra el usuario que procesa el pago`,
  })
  @ApiBody({
    type: CreateCyclePaymentDto,
    description: 'Datos del pago a registrar',
    examples: {
      pagoCompleto: {
        summary: 'Pago completo de ciclo',
        description: 'Pago que salda completamente un ciclo',
        value: {
          cycle_id: 15,
          amount: 2500.0,
          payment_method: 'EFECTIVO',
          notes: 'Pago completo del ciclo mensual',
        },
      },
      pagoParcial: {
        summary: 'Pago parcial',
        description: 'Pago parcial de un ciclo con saldo pendiente',
        value: {
          cycle_id: 20,
          amount: 1000.0,
          payment_method: 'TRANSFERENCIA',
          notes: 'Pago parcial - primera cuota',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Pago registrado exitosamente con actualización del estado del ciclo.',
    type: CyclePaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, monto excede saldo pendiente o método de pago no válido.',
  })
  @ApiResponse({
    status: 404,
    description: 'Ciclo de suscripción no encontrado.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - Solo usuarios SUPERADMIN pueden registrar pagos.',
  })
  async createCyclePayment(
    @Body(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: false,
        skipMissingProperties: false,
        disableErrorMessages: false,
      }),
    )
    createCyclePaymentDto: CreateCyclePaymentDto,
    @Request() req: any,
  ): Promise<CyclePaymentResponseDto> {
    // Log para debug: verificar que el monto llegue correctamente
    console.log(
      `🔍 DEBUG: Pago recibido para ciclo ${createCyclePaymentDto.cycle_id}, monto: ${createCyclePaymentDto.amount}`,
    );

    return this.cyclePaymentsService.createCyclePayment(
      createCyclePaymentDto,
      req.user.userId,
    );
  }

  @Get('cycle/:cycleId')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener resumen de pagos de un ciclo',
    description:
      'Obtiene el resumen completo de pagos de un ciclo específico, incluyendo todos los pagos realizados y el estado actual.',
  })
  @ApiParam({
    name: 'cycleId',
    description: 'ID del ciclo de suscripción',
    type: 'integer',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de pagos obtenido exitosamente',
    type: CyclePaymentSummaryDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Ciclo de suscripción no encontrado',
  })
  async getCyclePaymentSummary(
    @Param('cycleId', ParseIntPipe) cycleId: number,
  ): Promise<CyclePaymentSummaryDto> {
    return this.cyclePaymentsService.getCyclePaymentSummary(cycleId);
  }

  @Get('customer/:personId')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener pagos de un cliente',
    description:
      'Obtiene todos los pagos realizados por un cliente específico, organizados por ciclos de suscripción.',
  })
  @ApiParam({
    name: 'personId',
    description: 'ID del cliente',
    type: 'integer',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Pagos del cliente obtenidos exitosamente',
    type: [CyclePaymentSummaryDto],
  })
  async getCustomerPayments(
    @Param('personId', ParseIntPipe) personId: number,
  ): Promise<CyclePaymentSummaryDto[]> {
    return this.cyclePaymentsService.getCustomerPayments(personId);
  }

  @Get('pending')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener ciclos con pagos pendientes',
    description:
      'Obtiene todos los ciclos que tienen pagos pendientes, parciales o vencidos, ordenados por fecha de vencimiento.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ciclos con pagos pendientes obtenidos exitosamente',
    type: [CyclePaymentSummaryDto],
  })
  async getPendingPaymentCycles(): Promise<CyclePaymentSummaryDto[]> {
    return this.cyclePaymentsService.getPendingPaymentCycles();
  }

  @Post('transfer-credits/:subscriptionId/:newCycleId')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Transferir créditos acumulados al nuevo ciclo',
    description: `Transfiere créditos acumulados de pagos en exceso hacia un nuevo ciclo de la misma suscripción.

## 💳 GESTIÓN DE CRÉDITOS

**Funcionalidades:**
- Transferencia automática de saldos a favor
- Aplicación de créditos a nuevos ciclos
- Mantenimiento del historial de transferencias
- Validación de pertenencia a la misma suscripción

**Casos de Uso:**
- Cliente pagó de más en ciclo anterior
- Renovación de ciclo con saldo a favor
- Corrección de pagos duplicados
- Gestión de anticipos de pago`,
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'ID de la suscripción propietaria de los créditos',
    type: 'string',
    example: '123',
  })
  @ApiParam({
    name: 'newCycleId',
    description: 'ID del ciclo destino para aplicar los créditos',
    type: 'string',
    example: '456',
  })
  @ApiResponse({
    status: 200,
    description:
      'Créditos transferidos exitosamente con actualización de saldos.',
    schema: {
      properties: {
        message: {
          type: 'string',
          example: 'Créditos transferidos exitosamente',
        },
        transferred_amount: { type: 'number', example: 500.0 },
        new_cycle_balance: { type: 'number', example: 1500.0 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción o ciclo no encontrado.',
  })
  @ApiResponse({
    status: 400,
    description:
      'No hay créditos disponibles para transferir o ciclos no pertenecen a la misma suscripción.',
  })
  async transferCreditsToNewCycle(
    @Param('subscriptionId') subscriptionId: string,
    @Param('newCycleId') newCycleId: string,
  ): Promise<{ message: string }> {
    await this.cyclePaymentsService.transferCreditsToNewCycle(
      parseInt(subscriptionId),
      parseInt(newCycleId),
    );
    return { message: 'Créditos transferidos exitosamente' };
  }

  @Post('apply-credits/:subscriptionId')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Aplicar créditos acumulados a deudas pendientes',
    description: `Aplica automáticamente los créditos disponibles de una suscripción a sus ciclos con deudas pendientes.

## 🔄 APLICACIÓN AUTOMÁTICA DE CRÉDITOS

**Proceso Automático:**
- Identifica ciclos con saldos pendientes
- Aplica créditos disponibles por orden de antigüedad
- Actualiza estados de ciclos automáticamente
- Genera registro de aplicación de créditos

**Priorización:**
1. Ciclos vencidos (más antiguos primero)
2. Ciclos pendientes por fecha de vencimiento
3. Distribución proporcional si es necesario

**Casos de Uso:**
- Liquidación de deudas con saldos a favor
- Compensación automática de pagos
- Regularización de cuentas de clientes
- Cierre de ciclos con créditos acumulados`,
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'ID de la suscripción para aplicar créditos acumulados',
    type: 'string',
    example: '789',
  })
  @ApiResponse({
    status: 200,
    description:
      'Créditos aplicados exitosamente a deudas pendientes con detalle de aplicación.',
    schema: {
      properties: {
        message: { type: 'string', example: 'Créditos aplicados exitosamente' },
        applied_amount: { type: 'number', example: 1200.0 },
        cycles_affected: { type: 'number', example: 3 },
        remaining_credits: { type: 'number', example: 0.0 },
        remaining_debt: { type: 'number', example: 500.0 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada.',
  })
  @ApiResponse({
    status: 400,
    description:
      'No hay créditos disponibles para aplicar o no existen deudas pendientes.',
  })
  async applyCreditsToOutstandingDebt(
    @Param('subscriptionId') subscriptionId: string,
  ): Promise<{ message: string }> {
    await this.cyclePaymentsService.applyCreditsToOutstandingDebt(
      parseInt(subscriptionId),
    );
    return { message: 'Créditos aplicados exitosamente a deudas pendientes' };
  }

  @Get('overdue')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener ciclos vencidos',
    description:
      'Obtiene todos los ciclos que tienen pagos vencidos (fecha de vencimiento pasada y saldo pendiente).',
  })
  @ApiResponse({
    status: 200,
    description: 'Ciclos vencidos obtenidos exitosamente',
    type: [CyclePaymentSummaryDto],
  })
  async getOverdueCycles(): Promise<CyclePaymentSummaryDto[]> {
    const pendingCycles =
      await this.cyclePaymentsService.getPendingPaymentCycles();
    const currentDate = new Date();

    return pendingCycles.filter(
      (cycle) =>
        new Date(cycle.payment_due_date) < currentDate &&
        cycle.pending_balance > 0,
    );
  }

  @Get('statistics')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener estadísticas de pagos',
    description:
      'Obtiene estadísticas generales sobre los pagos de ciclos, incluyendo totales por estado y montos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        total_cycles: { type: 'number', description: 'Total de ciclos' },
        paid_cycles: {
          type: 'number',
          description: 'Ciclos completamente pagados',
        },
        pending_cycles: {
          type: 'number',
          description: 'Ciclos con pagos pendientes',
        },
        overdue_cycles: { type: 'number', description: 'Ciclos vencidos' },
        total_amount: {
          type: 'number',
          description: 'Monto total de todos los ciclos',
        },
        paid_amount: { type: 'number', description: 'Monto total pagado' },
        pending_amount: {
          type: 'number',
          description: 'Monto total pendiente',
        },
      },
    },
  })
  async getPaymentStatistics() {
    const allCycles = await this.cyclePaymentsService.getAllCycles();
    const currentDate = new Date();

    const statistics = {
      total_cycles: allCycles.length,
      paid_cycles: allCycles.filter((c) => c.payment_status === 'PAID').length,
      pending_cycles: allCycles.filter((c) =>
        ['PENDING', 'PARTIAL'].includes(c.payment_status),
      ).length,
      overdue_cycles: allCycles.filter(
        (c) =>
          new Date(c.payment_due_date) < currentDate && c.pending_balance > 0,
      ).length,
      total_amount: allCycles.reduce((sum, c) => sum + c.total_amount, 0),
      paid_amount: allCycles.reduce((sum, c) => sum + c.paid_amount, 0),
      pending_amount: allCycles.reduce((sum, c) => sum + c.pending_balance, 0),
    };

    return statistics;
  }

  @Post('recalculate/:cycleId')
  @Auth(Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recalcular ciclo específico',
    description:
      'Recalcula un ciclo específico usando el precio correcto del plan en lugar de sumar productos individuales',
  })
  @ApiParam({
    name: 'cycleId',
    description: 'ID del ciclo a recalcular',
    type: 'integer',
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: 'Ciclo recalculado exitosamente',
    schema: {
      properties: {
        cycle_id: { type: 'number' },
        old_total: { type: 'number' },
        new_total: { type: 'number' },
        corrected: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async recalculateSpecificCycle(
    @Param('cycleId', ParseIntPipe) cycleId: number,
  ) {
    return this.cycleCalculatorService.recalculateSpecificCycle(cycleId);
  }

  @Post('fix-all-incorrect-cycles')
  @Auth(Role.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Corregir todos los ciclos con cálculos incorrectos',
    description:
      'Encuentra y corrige automáticamente todos los ciclos que tienen cálculos incorrectos (total_amount diferente al precio del plan)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ciclos corregidos exitosamente',
    schema: {
      properties: {
        total_cycles_checked: { type: 'number' },
        cycles_corrected: { type: 'number' },
        corrections: {
          type: 'array',
          items: {
            properties: {
              cycle_id: { type: 'number' },
              subscription_id: { type: 'number' },
              plan_name: { type: 'string' },
              old_total: { type: 'number' },
              new_total: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async fixAllIncorrectCycles() {
    return this.cycleCalculatorService.findAndFixIncorrectCycles();
  }
}
