import {
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PaymentStatus, PrismaClient } from '@prisma/client';
import { CreateCyclePaymentDto } from './dto/create-cycle-payment.dto';
import {
  CyclePaymentResponseDto,
  CyclePaymentSummaryDto,
} from './dto/cycle-payment-response.dto';

@Injectable()
export class CyclePaymentsService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(CyclePaymentsService.name);

  constructor() {
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
        `La diferencia de ${amount - totalCycleAmount} se acreditará como crédito a favor del cliente.`
      );
    }
    
    this.logger.log(
      `Procesando pago: Monto del ciclo ${totalCycleAmount}, Pendiente ${pendingBalance}, Crédito actual ${creditBalance}, Pago recibido ${amount}`,
    );

    // Calcular recargos por mora si el ciclo está vencido
    const currentDate = new Date();
    const paymentDueDate = new Date(cycle.payment_due_date);
    let surchargeAmount = 0;

    if (
      currentDate > paymentDueDate &&
      cycle.payment_status !== PaymentStatus.PAID
    ) {
      surchargeAmount = await this.calculateLateFee(cycle);
      this.logger.log(
        `Aplicando recargo por mora de ${surchargeAmount} al ciclo ${cycle_id}`,
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

    // Configuración de recargos (esto podría venir de una tabla de configuración)
    const lateFeeConfig = {
      dailyRate: 0.02, // 2% diario
      maxRate: 0.3, // Máximo 30% del monto pendiente
      gracePeriod: 3, // 3 días de gracia
    };

    if (daysLate <= lateFeeConfig.gracePeriod) {
      return 0;
    }

    const effectiveDaysLate = daysLate - lateFeeConfig.gracePeriod;
    const feeRate = Math.min(
      effectiveDaysLate * lateFeeConfig.dailyRate,
      lateFeeConfig.maxRate,
    );
    const lateFee = cycle.pending_balance * feeRate;

    this.logger.log(
      `Calculando recargo por mora: ${daysLate} días de atraso, tasa ${feeRate * 100}%, recargo ${lateFee}`,
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
          in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE],
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
}
