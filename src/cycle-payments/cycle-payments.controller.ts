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

@ApiTags('Pagos de Ciclos')
@ApiBearerAuth()
@Controller('cycle-payments')
@UseGuards(JwtAuthGuard, UserRolesGuard)
export class CyclePaymentsController {
  constructor(private readonly cyclePaymentsService: CyclePaymentsService) {}

  @Post()
  @Auth(Role.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar pago de ciclo',
    description:
      'Registra un pago para un ciclo de suscripción específico. Calcula automáticamente recargos por mora si es necesario. Solo disponible para SUPERADMIN.',
  })
  @ApiBody({ type: CreateCyclePaymentDto })
  @ApiResponse({
    status: 201,
    description: 'Pago registrado exitosamente',
    type: CyclePaymentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o monto excede saldo pendiente',
  })
  @ApiResponse({
    status: 404,
    description: 'Ciclo de suscripción no encontrado',
  })
  async createCyclePayment(
    @Body() createCyclePaymentDto: CreateCyclePaymentDto,
    @Request() req: any,
  ): Promise<CyclePaymentResponseDto> {
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
  @ApiOperation({ summary: 'Transferir créditos acumulados al nuevo ciclo' })
  @ApiParam({ name: 'subscriptionId', description: 'ID de la suscripción' })
  @ApiParam({ name: 'newCycleId', description: 'ID del nuevo ciclo' })
  @ApiResponse({
    status: 200,
    description: 'Créditos transferidos exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción o ciclo no encontrado',
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
  @ApiOperation({ summary: 'Aplicar créditos acumulados a deudas pendientes' })
  @ApiParam({ name: 'subscriptionId', description: 'ID de la suscripción' })
  @ApiResponse({
    status: 200,
    description: 'Créditos aplicados exitosamente a deudas pendientes',
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada',
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
      paid_cycles: allCycles.filter((c) => c.payment_status === 'PAID')
        .length,
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
}
