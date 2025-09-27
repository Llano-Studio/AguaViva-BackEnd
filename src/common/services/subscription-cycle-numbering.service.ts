import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class SubscriptionCycleNumberingService {
  private readonly logger = new Logger(SubscriptionCycleNumberingService.name);
  private readonly prisma = new PrismaClient();

  /**
   * Obtiene el siguiente número de ciclo para una suscripción
   * @param subscriptionId ID de la suscripción
   * @returns Número del siguiente ciclo
   */
  async getNextCycleNumber(subscriptionId: number): Promise<number> {
    const existingCycle = await this.prisma.subscription_cycle.findFirst({
      where: {
        subscription_id: subscriptionId,
      },
      orderBy: {
        cycle_number: 'desc',
      },
      select: {
        cycle_number: true,
      },
    });

    const nextCycleNumber = existingCycle ? existingCycle.cycle_number + 1 : 1;

    this.logger.log(
      `Siguiente número de ciclo para suscripción ${subscriptionId}: ${nextCycleNumber}`,
    );

    return nextCycleNumber;
  }

  /**
   * Crea un nuevo ciclo con numeración correcta
   * @param subscriptionId ID de la suscripción
   * @param cycleData Datos del ciclo
   * @returns Ciclo creado
   */
  async createCycleWithNumber(
    subscriptionId: number,
    cycleData: {
      cycle_start: Date;
      cycle_end: Date;
      payment_due_date: Date;
      total_amount: number;
    },
  ) {
    const cycleNumber = await this.getNextCycleNumber(subscriptionId);

    const newCycle = await this.prisma.subscription_cycle.create({
      data: {
        subscription_id: subscriptionId,
        cycle_number: cycleNumber,
        cycle_start: cycleData.cycle_start,
        cycle_end: cycleData.cycle_end,
        payment_due_date: cycleData.payment_due_date,
        total_amount: cycleData.total_amount,
      },
      include: {
        customer_subscription: {
          select: {
            subscription_id: true,
            customer_id: true,
          },
        },
      },
    });

    this.logger.log(
      `Ciclo ${cycleNumber} creado para suscripción ${subscriptionId} con ID ${newCycle.cycle_id}`,
    );

    return newCycle;
  }

  /**
   * Obtiene todos los ciclos de una suscripción ordenados por número
   * @param subscriptionId ID de la suscripción
   * @returns Array de ciclos ordenados
   */
  async getCyclesBySubscription(subscriptionId: number) {
    return await this.prisma.subscription_cycle.findMany({
      where: {
        subscription_id: subscriptionId,
      },
      orderBy: {
        cycle_number: 'asc',
      },
      include: {
        subscription_cycle_detail: true,
        cycle_payments: true,
      },
    });
  }

  /**
   * Obtiene un ciclo específico por suscripción y número de ciclo
   * @param subscriptionId ID de la suscripción
   * @param cycleNumber Número del ciclo
   * @returns Ciclo encontrado o null
   */
  async getCycleByNumber(subscriptionId: number, cycleNumber: number) {
    return await this.prisma.subscription_cycle.findFirst({
      where: {
        subscription_id: subscriptionId,
        cycle_number: cycleNumber,
      },
      include: {
        subscription_cycle_detail: true,
        cycle_payments: true,
        customer_subscription: {
          select: {
            subscription_id: true,
            customer_id: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Obtiene el ciclo actual (más reciente) de una suscripción
   * @param subscriptionId ID de la suscripción
   * @returns Ciclo actual o null
   */
  async getCurrentCycle(subscriptionId: number) {
    return await this.prisma.subscription_cycle.findFirst({
      where: {
        subscription_id: subscriptionId,
      },
      orderBy: {
        cycle_number: 'desc',
      },
      include: {
        subscription_cycle_detail: true,
        cycle_payments: true,
      },
    });
  }

  /**
   * Valida que no exista un ciclo con el mismo número para la suscripción
   * @param subscriptionId ID de la suscripción
   * @param cycleNumber Número del ciclo a validar
   * @returns true si es válido, false si ya existe
   */
  async validateCycleNumber(
    subscriptionId: number,
    cycleNumber: number,
  ): Promise<boolean> {
    const existingCycle = await this.prisma.subscription_cycle.findFirst({
      where: {
        subscription_id: subscriptionId,
        cycle_number: cycleNumber,
      },
    });

    return !existingCycle;
  }

  /**
   * Renumera todos los ciclos de una suscripción
   * Útil para migración de datos o corrección de numeración
   * @param subscriptionId ID de la suscripción
   * @returns Número de ciclos renumerados
   */
  async renumberCycles(subscriptionId: number): Promise<number> {
    this.logger.log(
      `Iniciando renumeración de ciclos para suscripción ${subscriptionId}`,
    );

    // Obtener todos los ciclos ordenados por fecha de inicio
    const cycles = await this.prisma.subscription_cycle.findMany({
      where: {
        subscription_id: subscriptionId,
      },
      orderBy: {
        cycle_start: 'asc',
      },
    });

    let renumberedCount = 0;

    // Renumerar cada ciclo secuencialmente
    for (let i = 0; i < cycles.length; i++) {
      const newCycleNumber = i + 1;
      const cycle = cycles[i];

      if (cycle.cycle_number !== newCycleNumber) {
        await this.prisma.subscription_cycle.update({
          where: { cycle_id: cycle.cycle_id },
          data: { cycle_number: newCycleNumber },
        });
        renumberedCount++;

        this.logger.log(
          `Ciclo ${cycle.cycle_id} renumerado de ${cycle.cycle_number} a ${newCycleNumber}`,
        );
      }
    }

    this.logger.log(
      `Renumeración completada para suscripción ${subscriptionId}: ${renumberedCount} ciclos actualizados`,
    );

    return renumberedCount;
  }

  /**
   * Obtiene estadísticas de ciclos para una suscripción
   * @param subscriptionId ID de la suscripción
   * @returns Estadísticas de ciclos
   */
  async getCycleStats(subscriptionId: number) {
    const cycles = await this.prisma.subscription_cycle.findMany({
      where: {
        subscription_id: subscriptionId,
      },
      include: {
        cycle_payments: true,
      },
    });

    const totalCycles = cycles.length;
    const paidCycles = cycles.filter((c) => c.payment_status === 'PAID').length;
    const pendingCycles = cycles.filter(
      (c) => c.payment_status === 'PENDING',
    ).length;
    const overdueCycles = cycles.filter(
      (c) => c.payment_status === 'OVERDUE',
    ).length;

    const totalAmount = cycles.reduce(
      (sum, cycle) => sum + Number(cycle.total_amount),
      0,
    );
    const paidAmount = cycles.reduce(
      (sum, cycle) => sum + Number(cycle.paid_amount),
      0,
    );

    return {
      subscription_id: subscriptionId,
      total_cycles: totalCycles,
      paid_cycles: paidCycles,
      pending_cycles: pendingCycles,
      overdue_cycles: overdueCycles,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      pending_amount: totalAmount - paidAmount,
      current_cycle_number:
        totalCycles > 0 ? Math.max(...cycles.map((c) => c.cycle_number)) : 0,
    };
  }

  /**
   * Verifica la integridad de la numeración de ciclos
   * @param subscriptionId ID de la suscripción
   * @returns Resultado de la verificación
   */
  async verifyCycleNumberingIntegrity(subscriptionId: number) {
    const cycles = await this.prisma.subscription_cycle.findMany({
      where: {
        subscription_id: subscriptionId,
      },
      orderBy: {
        cycle_number: 'asc',
      },
      select: {
        cycle_id: true,
        cycle_number: true,
        cycle_start: true,
      },
    });

    const issues = [];
    const expectedNumbers = Array.from(
      { length: cycles.length },
      (_, i) => i + 1,
    );
    const actualNumbers = cycles.map((c) => c.cycle_number);

    // Verificar secuencia continua
    for (let i = 0; i < expectedNumbers.length; i++) {
      if (actualNumbers[i] !== expectedNumbers[i]) {
        issues.push({
          type: 'SEQUENCE_BREAK',
          cycle_id: cycles[i].cycle_id,
          expected: expectedNumbers[i],
          actual: actualNumbers[i],
        });
      }
    }

    // Verificar duplicados
    const duplicates = actualNumbers.filter(
      (num, index) => actualNumbers.indexOf(num) !== index,
    );
    if (duplicates.length > 0) {
      issues.push({
        type: 'DUPLICATES',
        duplicated_numbers: [...new Set(duplicates)],
      });
    }

    return {
      subscription_id: subscriptionId,
      is_valid: issues.length === 0,
      total_cycles: cycles.length,
      issues,
    };
  }
}
