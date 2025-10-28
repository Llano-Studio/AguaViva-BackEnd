import {
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PaymentStatus, PrismaClient, Role } from '@prisma/client';
import { CreateCyclePaymentDto } from './dto/create-cycle-payment.dto';
import {
  CyclePaymentResponseDto,
  CyclePaymentSummaryDto,
} from './dto/cycle-payment-response.dto';
import { UpdateCyclePaymentDto, DeletePaymentDto, PaymentOperationResponseDto } from './dto';
import { PaymentSemaphoreService } from '../common/services/payment-semaphore.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CyclePaymentsService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(CyclePaymentsService.name);

  constructor(
    private readonly paymentSemaphoreService: PaymentSemaphoreService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Registra un pago para un ciclo de suscripción específico
   * Calcula automáticamente recargos por mora si es necesario
   * Gestiona créditos y deudas acumulables entre ciclos
   */
  async createCyclePayment(
    createCyclePaymentDto: CreateCyclePaymentDto,
    userId: number,
  ): Promise<CyclePaymentResponseDto> {
    const { cycle_id, amount, payment_method, payment_date, reference, notes } =
      createCyclePaymentDto;

    // Verificar que el ciclo existe
    const cycle = await this.subscription_cycle.findUnique({
      where: { cycle_id },
      include: {
        customer_subscription: {
          include: {
            person: true,
            subscription_plan: true,
          },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        `Ciclo de suscripción con ID ${cycle_id} no encontrado`,
      );
    }

    // CORRECCIÓN: Permitir pagos mayores al monto del ciclo para acreditar diferencia al próximo ciclo
    // Ya no limitamos el monto del pago. Los pagos excedentes se convertirán en crédito.
    const totalCycleAmount = Number(cycle.total_amount);
    const creditBalance = Number(cycle.credit_balance);
    const pendingBalance = Number(cycle.pending_balance);

    // Validación explícita: PERMITIR sobrepagos
    if (amount > totalCycleAmount) {
      this.logger.log(
        `✅ SOBREPAGO DETECTADO: Monto recibido ${amount} excede el total del ciclo ${totalCycleAmount}. ` +
          `La diferencia de ${amount - totalCycleAmount} se acreditará como crédito a favor del cliente.`,
      );
    }

    this.logger.log(
      `Procesando pago: Monto del ciclo ${totalCycleAmount}, Pendiente ${pendingBalance}, Crédito actual ${creditBalance}, Pago recibido ${amount}`,
    );

    // Calcular recargos por mora si el ciclo está vencido Y NO se ha aplicado previamente
    const currentDate = new Date();
    const paymentDueDate = new Date(cycle.payment_due_date);
    let surchargeAmount = 0;

    if (
      currentDate > paymentDueDate &&
      cycle.payment_status !== PaymentStatus.PAID &&
      !cycle.late_fee_applied // 🔧 CORRECCIÓN: Solo aplicar si no se ha aplicado antes
    ) {
      surchargeAmount = await this.calculateLateFee(cycle);
      this.logger.log(
        `Aplicando recargo por mora de ${surchargeAmount} al ciclo ${cycle_id} (primera vez)`,
      );
    } else if (cycle.late_fee_applied) {
      this.logger.log(
        `Recargo por mora ya aplicado previamente al ciclo ${cycle_id}, no se aplicará nuevamente`,
      );
    }

    // Iniciar transacción para registrar el pago
    const result = await this.$transaction(async (tx) => {
      // Registrar el pago
      const payment = await tx.cycle_payment.create({
        data: {
          cycle_id,
          payment_date: payment_date ? new Date(payment_date) : new Date(),
          amount,
          payment_method,
          reference,
          notes,
          created_by: userId,
        },
      });

      // Calcular nuevos balances considerando créditos acumulados
      let remainingPayment = amount;
      let newCreditBalance = parseFloat(
        cycle.credit_balance?.toString() || '0',
      );
      let newPendingBalance = parseFloat(
        cycle.pending_balance?.toString() || '0',
      );
      let newPaidAmount = parseFloat(cycle.paid_amount?.toString() || '0');

      // Primero aplicar el pago a la deuda pendiente
      if (remainingPayment > 0 && newPendingBalance > 0) {
        const appliedToPending = Math.min(remainingPayment, newPendingBalance);
        newPendingBalance -= appliedToPending;
        newPaidAmount += appliedToPending;
        remainingPayment -= appliedToPending;
      }

      // Si queda dinero después de pagar la deuda, se convierte en crédito
      if (remainingPayment > 0) {
        newCreditBalance += remainingPayment;
      }

      // Aplicar recargo por mora si corresponde
      if (surchargeAmount > 0) {
        newPendingBalance += surchargeAmount;
      }

      // Determinar el estado del pago
      let newPaymentStatus = cycle.payment_status;
      if (newPendingBalance <= 0) {
        newPaymentStatus = PaymentStatus.PAID;
      } else if (newPaidAmount > 0) {
        newPaymentStatus = PaymentStatus.PARTIAL;
      }

      // Si hay crédito acumulado, marcar como CREDITED
      if (newCreditBalance > 0 && newPendingBalance <= 0) {
        newPaymentStatus = PaymentStatus.CREDITED;
      }

      // Si hay recargo por mora, actualizar el total del ciclo
      const newTotalAmount =
        surchargeAmount > 0
          ? parseFloat(cycle.total_amount?.toString() || '0') + surchargeAmount
          : parseFloat(cycle.total_amount?.toString() || '0');

      await tx.subscription_cycle.update({
        where: { cycle_id },
        data: {
          paid_amount: newPaidAmount,
          pending_balance: Math.max(0, newPendingBalance),
          credit_balance: newCreditBalance,
          payment_status: newPaymentStatus,
          total_amount: newTotalAmount,
          late_fee_applied: surchargeAmount > 0 ? true : cycle.late_fee_applied,
          late_fee_percentage: surchargeAmount > 0 ? 0.2 : cycle.late_fee_percentage,
        },
      });

      // Si se aplicó recargo, registrarlo como un ajuste
      if (surchargeAmount > 0) {
        await tx.cycle_payment.create({
          data: {
            cycle_id,
            payment_date: new Date(),
            amount: -surchargeAmount, // Negativo para indicar que es un cargo adicional
            payment_method: 'RECARGO_MORA',
            reference: `AUTO-SURCHARGE-${cycle_id}`,
            notes: `Recargo automático por mora aplicado el ${new Date().toISOString()}`,
            created_by: userId,
          },
        });
      }

      return payment;
    });

    this.logger.log(
      `Pago registrado exitosamente para el ciclo ${cycle_id} por monto ${amount}`,
    );

    // 🆕 CORRECCIÓN: Invalidar cache del semáforo de pago para que se recalcule inmediatamente
    this.paymentSemaphoreService.invalidateCache(cycle.customer_subscription.customer_id);

    return {
      payment_id: result.payment_id,
      cycle_id: result.cycle_id,
      payment_date: result.payment_date,
      amount: parseFloat(result.amount?.toString() || '0'),
      payment_method: result.payment_method,
      reference: result.reference,
      notes: result.notes,
      created_by: result.created_by,
    };
  }

  /**
   * Obtiene el resumen de pagos de un ciclo específico
   */
  async getCyclePaymentSummary(
    cycleId: number,
  ): Promise<CyclePaymentSummaryDto> {
    const cycle = await this.subscription_cycle.findUnique({
      where: { cycle_id: cycleId },
      include: {
        cycle_payments: {
          orderBy: { payment_date: 'desc' },
        },
      },
    });

    if (!cycle) {
      throw new NotFoundException(
        `Ciclo de suscripción con ID ${cycleId} no encontrado`,
      );
    }

    const payments: CyclePaymentResponseDto[] = cycle.cycle_payments.map(
      (payment) => ({
        payment_id: payment.payment_id,
        cycle_id: payment.cycle_id,
        payment_date: payment.payment_date,
        amount: parseFloat(payment.amount?.toString() || '0'),
        payment_method: payment.payment_method,
        reference: payment.reference,
        notes: payment.notes,
        created_by: payment.created_by,
      }),
    );

    return {
      cycle_id: cycle.cycle_id,
      total_amount: parseFloat(cycle.total_amount?.toString() || '0'),
      paid_amount: parseFloat(cycle.paid_amount?.toString() || '0'),
      pending_balance: parseFloat(cycle.pending_balance?.toString() || '0'),
      credit_balance: parseFloat(cycle.credit_balance?.toString() || '0'),
      payment_status: cycle.payment_status,
      payment_due_date: cycle.payment_due_date,
      payments,
    };
  }

  /**
   * Obtiene todos los pagos de un cliente específico
   */
  async getCustomerPayments(
    personId: number,
  ): Promise<CyclePaymentSummaryDto[]> {
    const subscriptions = await this.customer_subscription.findMany({
      where: { customer_id: personId },
    });

    const cycles = await this.subscription_cycle.findMany({
      where: {
        subscription_id: {
          in: subscriptions.map((sub) => sub.subscription_id),
        },
      },
      include: {
        cycle_payments: {
          orderBy: { payment_date: 'desc' },
        },
        customer_subscription: {
          include: {
            subscription_plan: true,
          },
        },
      },
      orderBy: { cycle_start: 'desc' },
    });

    const paymentSummaries: CyclePaymentSummaryDto[] = [];

    for (const cycle of cycles) {
      const payments: CyclePaymentResponseDto[] = cycle.cycle_payments.map(
        (payment) => ({
          payment_id: payment.payment_id,
          cycle_id: payment.cycle_id,
          payment_date: payment.payment_date,
          amount: parseFloat(payment.amount?.toString() || '0'),
          payment_method: payment.payment_method,
          reference: payment.reference,
          notes: payment.notes,
          created_by: payment.created_by,
        }),
      );

      paymentSummaries.push({
        cycle_id: cycle.cycle_id,
        total_amount: parseFloat(cycle.total_amount?.toString() || '0'),
        paid_amount: parseFloat(cycle.paid_amount?.toString() || '0'),
        pending_balance: parseFloat(cycle.pending_balance?.toString() || '0'),
        credit_balance: parseFloat(cycle.credit_balance?.toString() || '0'),
        payment_status: cycle.payment_status,
        payment_due_date: cycle.payment_due_date,
        payments,
      });
    }

    return paymentSummaries;
  }

  /**
   * Calcula el recargo por mora basado en los días de atraso
   * 🔧 CORRECCIÓN: Usar 20% fijo como el sistema automático
   */
  private async calculateLateFee(cycle: any): Promise<number> {
    const currentDate = new Date();
    const paymentDueDate = new Date(cycle.payment_due_date);
    const daysLate = Math.floor(
      (currentDate.getTime() - paymentDueDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    if (daysLate <= 0) {
      return 0;
    }

    // 🔧 CORRECCIÓN: Usar configuración consistente con el sistema automático
    const lateFeeConfig = {
      feeRate: 0.2, // 20% fijo (igual que el sistema automático)
      gracePeriod: 0, // Sin período de gracia para consistencia
    };

    if (daysLate <= lateFeeConfig.gracePeriod) {
      return 0;
    }

    // 🔧 CORRECCIÓN: Aplicar 20% fijo sobre el monto pendiente
    const lateFee = cycle.pending_balance * lateFeeConfig.feeRate;

    this.logger.log(
      `Calculando recargo por mora: ${daysLate} días de atraso, tasa ${lateFeeConfig.feeRate * 100}%, recargo ${lateFee}`,
    );

    return Math.round(lateFee * 100) / 100; // Redondear a 2 decimales
  }

  /**
   * Transfiere créditos acumulados del ciclo anterior al nuevo ciclo
   */
  async transferCreditsToNewCycle(
    subscriptionId: number,
    newCycleId: number,
  ): Promise<void> {
    // Buscar el ciclo anterior con créditos acumulados
    const previousCycle = await this.subscription_cycle.findFirst({
      where: {
        subscription_id: subscriptionId,
        cycle_id: { not: newCycleId },
        credit_balance: { gt: 0 },
      },
      orderBy: { cycle_end: 'desc' },
    });

    if (
      !previousCycle ||
      parseFloat(previousCycle.credit_balance?.toString() || '0') <= 0
    ) {
      return; // No hay créditos para transferir
    }

    await this.$transaction(async (tx) => {
      // Transferir créditos al nuevo ciclo
      await tx.subscription_cycle.update({
        where: { cycle_id: newCycleId },
        data: {
          credit_balance: previousCycle.credit_balance,
        },
      });

      // Limpiar créditos del ciclo anterior
      await tx.subscription_cycle.update({
        where: { cycle_id: previousCycle.cycle_id },
        data: {
          credit_balance: 0,
        },
      });

      // Registrar la transferencia como un movimiento
      await tx.cycle_payment.create({
        data: {
          cycle_id: newCycleId,
          payment_date: new Date(),
          amount: previousCycle.credit_balance,
          payment_method: 'TRANSFERENCIA_CREDITO',
          reference: `TRANSFER-FROM-CYCLE-${previousCycle.cycle_id}`,
          notes: `Crédito transferido desde ciclo anterior ${previousCycle.cycle_id}`,
          created_by: null,
        },
      });
    });

    this.logger.log(
      `Crédito de ${previousCycle.credit_balance} transferido del ciclo ${previousCycle.cycle_id} al ciclo ${newCycleId}`,
    );
  }

  /**
   * Aplica créditos acumulados a deudas pendientes de ciclos anteriores
   */
  async applyCreditsToOutstandingDebt(subscriptionId: number): Promise<void> {
    // Buscar ciclos con créditos y deudas pendientes
    const cycles = await this.subscription_cycle.findMany({
      where: {
        subscription_id: subscriptionId,
        OR: [{ credit_balance: { gt: 0 } }, { pending_balance: { gt: 0 } }],
      },
      orderBy: { cycle_start: 'asc' },
    });

    let availableCredits = 0;
    const cyclesWithDebt = [];
    const cyclesWithCredit = [];

    // Separar ciclos con créditos y deudas
    for (const cycle of cycles) {
      const creditBalance = parseFloat(cycle.credit_balance?.toString() || '0');
      const pendingBalance = parseFloat(
        cycle.pending_balance?.toString() || '0',
      );

      if (creditBalance > 0) {
        cyclesWithCredit.push(cycle);
        availableCredits += creditBalance;
      }
      if (pendingBalance > 0) {
        cyclesWithDebt.push(cycle);
      }
    }

    if (availableCredits <= 0 || cyclesWithDebt.length === 0) {
      return; // No hay créditos o deudas para procesar
    }

    let remainingCredits = availableCredits;

    await this.$transaction(async (tx) => {
      // Aplicar créditos a las deudas más antiguas primero
      for (const debtCycle of cyclesWithDebt) {
        if (remainingCredits <= 0) break;

        const appliedAmount = Math.min(
          remainingCredits,
          debtCycle.pending_balance,
        );
        const newPendingBalance = debtCycle.pending_balance - appliedAmount;
        const newPaidAmount = debtCycle.paid_amount + appliedAmount;

        // Actualizar estado del pago
        let newPaymentStatus = debtCycle.payment_status;
        if (newPendingBalance <= 0) {
          newPaymentStatus = PaymentStatus.PAID;
        } else if (newPaidAmount > 0) {
          newPaymentStatus = PaymentStatus.PARTIAL;
        }

        await tx.subscription_cycle.update({
          where: { cycle_id: debtCycle.cycle_id },
          data: {
            pending_balance: newPendingBalance,
            paid_amount: newPaidAmount,
            payment_status: newPaymentStatus,
          },
        });

        // Registrar el pago aplicado desde créditos
        await tx.cycle_payment.create({
          data: {
            cycle_id: debtCycle.cycle_id,
            payment_date: new Date(),
            amount: appliedAmount,
            payment_method: 'APLICACION_CREDITO',
            reference: `CREDIT-APPLICATION-${debtCycle.cycle_id}`,
            notes: `Crédito aplicado automáticamente a deuda pendiente`,
            created_by: null,
          },
        });

        remainingCredits -= appliedAmount;
      }

      // Actualizar los créditos restantes en los ciclos
      let creditsToDistribute = remainingCredits;
      for (const creditCycle of cyclesWithCredit) {
        if (creditsToDistribute <= 0) {
          // Limpiar todos los créditos restantes
          await tx.subscription_cycle.update({
            where: { cycle_id: creditCycle.cycle_id },
            data: { credit_balance: 0 },
          });
        } else {
          const newCreditBalance = Math.min(
            creditsToDistribute,
            creditCycle.credit_balance,
          );
          await tx.subscription_cycle.update({
            where: { cycle_id: creditCycle.cycle_id },
            data: { credit_balance: newCreditBalance },
          });
          creditsToDistribute -= creditCycle.credit_balance;
        }
      }
    });

    this.logger.log(
      `Aplicados ${availableCredits - remainingCredits} en créditos a deudas pendientes de la suscripción ${subscriptionId}`,
    );
  }

  /**
   * Obtiene todos los ciclos de suscripción
   */
  async getAllCycles(): Promise<CyclePaymentSummaryDto[]> {
    const cycles = await this.subscription_cycle.findMany({
      include: {
        cycle_payments: {
          orderBy: { payment_date: 'desc' },
        },
        customer_subscription: {
          include: {
            person: true,
          },
        },
      },
      orderBy: { payment_due_date: 'asc' },
    });

    return cycles.map((cycle) => {
      const payments: CyclePaymentResponseDto[] = cycle.cycle_payments.map(
        (payment) => ({
          payment_id: payment.payment_id,
          cycle_id: payment.cycle_id,
          payment_date: payment.payment_date,
          amount: parseFloat(payment.amount?.toString() || '0'),
          payment_method: payment.payment_method,
          reference: payment.reference,
          notes: payment.notes,
          created_by: payment.created_by,
        }),
      );

      return {
        cycle_id: cycle.cycle_id,
        total_amount: parseFloat(cycle.total_amount?.toString() || '0'),
        paid_amount: parseFloat(cycle.paid_amount?.toString() || '0'),
        pending_balance: parseFloat(cycle.pending_balance?.toString() || '0'),
        credit_balance: parseFloat(cycle.credit_balance?.toString() || '0'),
        payment_status: cycle.payment_status,
        payment_due_date: cycle.payment_due_date,
        payments,
      };
    });
  }

  /**
   * Obtiene los ciclos con pagos pendientes
   */
  async getPendingPaymentCycles(): Promise<CyclePaymentSummaryDto[]> {
    const cycles = await this.subscription_cycle.findMany({
      where: {
        payment_status: {
          in: [
            PaymentStatus.PENDING,
            PaymentStatus.PARTIAL,
            PaymentStatus.OVERDUE,
          ],
        },
        pending_balance: {
          gt: 0,
        },
      },
      include: {
        cycle_payments: {
          orderBy: { payment_date: 'desc' },
        },
        customer_subscription: {
          include: {
            person: true,
          },
        },
      },
      orderBy: { payment_due_date: 'asc' },
    });

    return cycles.map((cycle) => {
      const payments: CyclePaymentResponseDto[] = cycle.cycle_payments.map(
        (payment) => ({
          payment_id: payment.payment_id,
          cycle_id: payment.cycle_id,
          payment_date: payment.payment_date,
          amount: parseFloat(payment.amount?.toString() || '0'),
          payment_method: payment.payment_method,
          reference: payment.reference,
          notes: payment.notes,
          created_by: payment.created_by,
        }),
      );

      return {
        cycle_id: cycle.cycle_id,
        total_amount: parseFloat(cycle.total_amount?.toString() || '0'),
        paid_amount: parseFloat(cycle.paid_amount?.toString() || '0'),
        pending_balance: parseFloat(cycle.pending_balance?.toString() || '0'),
        credit_balance: parseFloat(cycle.credit_balance?.toString() || '0'),
        payment_status: cycle.payment_status,
        payment_due_date: cycle.payment_due_date,
        payments,
      };
    });
  }

  /**
   * Actualiza un pago de ciclo existente
   */
  async updateCyclePayment(
    paymentId: number,
    updateCyclePaymentDto: UpdateCyclePaymentDto,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PaymentOperationResponseDto> {
    // Verificar que el pago existe
    const existingPayment = await this.cycle_payment.findUnique({
      where: { payment_id: paymentId },
      include: {
        subscription_cycle: {
          include: {
            customer_subscription: true,
          },
        },
      },
    });

    if (!existingPayment) {
      throw new NotFoundException(`Pago con ID ${paymentId} no encontrado`);
    }

    // Validar permisos de actualización
    await this.validatePaymentUpdate(existingPayment, userId);

    // Guardar valores anteriores para auditoría
    const oldValues = {
      amount: parseFloat(existingPayment.amount?.toString() || '0'),
      payment_method: existingPayment.payment_method,
      payment_date: existingPayment.payment_date,
      reference: existingPayment.reference,
      notes: existingPayment.notes,
    };

    const result = await this.$transaction(async (tx) => {
      // Actualizar el pago
      const updatedPayment = await tx.cycle_payment.update({
        where: { payment_id: paymentId },
        data: {
          amount: updateCyclePaymentDto.amount,
          payment_method: updateCyclePaymentDto.payment_method,
          payment_date: updateCyclePaymentDto.payment_date
            ? new Date(updateCyclePaymentDto.payment_date)
            : existingPayment.payment_date,
          reference: updateCyclePaymentDto.reference ?? existingPayment.reference,
          notes: updateCyclePaymentDto.notes ?? existingPayment.notes,
          updated_at: new Date(),
          updated_by: userId,
        },
      });

      // Recalcular balances del ciclo si cambió el monto
      if (updateCyclePaymentDto.amount !== oldValues.amount) {
        await this.recalculateCycleBalances(existingPayment.cycle_id, tx);
      }

      return updatedPayment;
    });

    // Crear registro de auditoría
    const auditId = await this.auditService.createAuditRecord({
      tableName: 'cycle_payment',
      recordId: paymentId,
      operationType: 'UPDATE',
      oldValues,
      newValues: {
        amount: updateCyclePaymentDto.amount,
        payment_method: updateCyclePaymentDto.payment_method,
        payment_date: updateCyclePaymentDto.payment_date,
        reference: updateCyclePaymentDto.reference,
        notes: updateCyclePaymentDto.notes,
      },
      userId,
      reason: 'Actualización de pago de ciclo',
      ipAddress,
      userAgent,
    });

    // Invalidar cache del semáforo de pago
    this.paymentSemaphoreService.invalidateCache(
      existingPayment.subscription_cycle.customer_subscription.customer_id,
    );

    this.logger.log(
      `Pago ${paymentId} actualizado exitosamente por usuario ${userId}`,
    );

    return {
      success: true,
      message: 'Pago actualizado exitosamente',
      audit_id: auditId,
      data: {
        payment_id: result.payment_id,
        cycle_id: result.cycle_id,
        payment_date: result.payment_date,
        amount: parseFloat(result.amount?.toString() || '0'),
        payment_method: result.payment_method,
        reference: result.reference,
        notes: result.notes,
      },
      metadata: {
        operation_type: 'UPDATE',
        timestamp: new Date().toISOString(),
        affected_records: 1,
      },
    };
  }

  /**
   * Elimina un pago de ciclo
   */
  async deleteCyclePayment(
    paymentId: number,
    deletePaymentDto: DeletePaymentDto,
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PaymentOperationResponseDto> {
    // Verificar que el pago existe
    const existingPayment = await this.cycle_payment.findUnique({
      where: { payment_id: paymentId },
      include: {
        subscription_cycle: {
          include: {
            customer_subscription: true,
          },
        },
      },
    });

    if (!existingPayment) {
      throw new NotFoundException(`Pago con ID ${paymentId} no encontrado`);
    }

    // Validar código de confirmación
    if (!this.auditService.validateConfirmationCode(deletePaymentDto.confirmation_code)) {
      throw new Error('Código de confirmación inválido');
    }

    // Validar permisos de eliminación
    await this.validatePaymentDeletion(existingPayment, userId);

    // Guardar valores para auditoría
    const oldValues = {
      payment_id: existingPayment.payment_id,
      cycle_id: existingPayment.cycle_id,
      amount: parseFloat(existingPayment.amount?.toString() || '0'),
      payment_method: existingPayment.payment_method,
      payment_date: existingPayment.payment_date,
      reference: existingPayment.reference,
      notes: existingPayment.notes,
      created_by: existingPayment.created_by,
    };

    await this.$transaction(async (tx) => {
      // Eliminar el pago
      await tx.cycle_payment.delete({
        where: { payment_id: paymentId },
      });

      // Recalcular balances del ciclo
      await this.recalculateCycleBalances(existingPayment.cycle_id, tx);
    });

    // Crear registro de auditoría
    const auditId = await this.auditService.createAuditRecord({
      tableName: 'cycle_payment',
      recordId: paymentId,
      operationType: 'DELETE',
      oldValues,
      userId,
      reason: deletePaymentDto.reason,
      ipAddress,
      userAgent,
    });

    // Invalidar cache del semáforo de pago
    this.paymentSemaphoreService.invalidateCache(
      existingPayment.subscription_cycle.customer_subscription.customer_id,
    );

    this.logger.log(
      `Pago ${paymentId} eliminado exitosamente por usuario ${userId}. Motivo: ${deletePaymentDto.reason}`,
    );

    return {
      success: true,
      message: 'Pago eliminado exitosamente',
      audit_id: auditId,
      metadata: {
        operation_type: 'DELETE',
        timestamp: new Date().toISOString(),
        affected_records: 1,
      },
    };
  }

  /**
   * Valida si un pago puede ser actualizado
   */
  async validatePaymentUpdate(payment: any, userId: number): Promise<void> {
    // Verificar permisos del usuario
    const hasPermission = await this.auditService.validateAuditPermissions(userId, 'UPDATE_PAYMENT');
    if (!hasPermission) {
      throw new ForbiddenException('No tiene permisos para actualizar pagos');
    }

    // Verificar que el pago no sea muy antiguo (ej: más de 30 días)
    const paymentDate = new Date(payment.payment_date);
    const daysDifference = Math.floor(
      (new Date().getTime() - paymentDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDifference > 30) {
      throw new BadRequestException('No se pueden actualizar pagos con más de 30 días de antigüedad');
    }

    // Verificar que el ciclo no esté cerrado o procesado
    if (payment.subscription_cycle.payment_status === 'PROCESSED') {
      throw new BadRequestException('No se pueden actualizar pagos de ciclos ya procesados');
    }
  }

  /**
   * Valida si un pago puede ser eliminado
   */
  async validatePaymentDeletion(payment: any, userId: number): Promise<void> {
    // Verificar permisos del usuario (administradores y jefes administrativos pueden eliminar)
    const user = await this.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || !['SUPERADMIN', 'BOSSADMINISTRATIVE', 'ADMINISTRATIVE'].includes(user.role as any)) {
      throw new ForbiddenException('No tiene permisos para eliminar pagos');
    }

    // Verificar que no sea el único pago del ciclo si el ciclo está marcado como pagado
    const cyclePayments = await this.cycle_payment.count({
      where: { cycle_id: payment.cycle_id },
    });

    if (cyclePayments === 1 && payment.subscription_cycle.payment_status === 'PAID') {
      throw new BadRequestException('No se puede eliminar el único pago de un ciclo marcado como pagado');
    }
  }

  /**
   * Recalcula los balances de un ciclo después de modificar pagos
   */
  private async recalculateCycleBalances(cycleId: number, tx: any): Promise<void> {
    // Obtener el ciclo y todos sus pagos
    const cycle = await tx.subscription_cycle.findUnique({
      where: { cycle_id: cycleId },
      include: {
        cycle_payments: true,
      },
    });

    if (!cycle) {
      throw new NotFoundException(`Ciclo ${cycleId} no encontrado`);
    }

    // Calcular totales de pagos
    const totalPayments = cycle.cycle_payments.reduce((sum: number, payment: any) => {
      return sum + parseFloat(payment.amount?.toString() || '0');
    }, 0);

    const totalAmount = parseFloat(cycle.total_amount?.toString() || '0');
    const pendingBalance = Math.max(0, totalAmount - totalPayments);
    const creditBalance = Math.max(0, totalPayments - totalAmount);

    // Determinar estado del pago
    let paymentStatus = 'PENDING';
    if (pendingBalance <= 0 && creditBalance > 0) {
      paymentStatus = 'CREDITED';
    } else if (pendingBalance <= 0) {
      paymentStatus = 'PAID';
    } else if (totalPayments > 0) {
      paymentStatus = 'PARTIAL';
    }

    // Actualizar el ciclo
    await tx.subscription_cycle.update({
      where: { cycle_id: cycleId },
      data: {
        paid_amount: totalPayments,
        pending_balance: pendingBalance,
        credit_balance: creditBalance,
        payment_status: paymentStatus,
      },
    });

    this.logger.log(
      `Balances recalculados para ciclo ${cycleId}: Pagado ${totalPayments}, Pendiente ${pendingBalance}, Crédito ${creditBalance}`,
    );
  }
}
