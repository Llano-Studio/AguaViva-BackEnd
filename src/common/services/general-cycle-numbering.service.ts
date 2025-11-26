import { PrismaClient, PaymentStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GeneralCycleNumberingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Obtiene el siguiente número de ciclo para una suscripción
   * @param subscriptionId ID de la suscripción
   * @returns El siguiente número de ciclo
   */
  async getNextCycleNumber(subscriptionId: number): Promise<number> {
    try {
      // Buscar el último ciclo de la suscripción
      const lastCycle = await this.prisma.subscription_cycle.findFirst({
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

      // Si no hay ciclos previos, empezar en 1
      if (!lastCycle) {
        return 1;
      }

      // Retornar el siguiente número
      return lastCycle.cycle_number + 1;
    } catch (error) {
      console.error(
        `Error obteniendo siguiente número de ciclo para suscripción ${subscriptionId}:`,
        error,
      );
      throw new Error(
        `No se pudo obtener el siguiente número de ciclo: ${error.message}`,
      );
    }
  }

  /**
   * Crea un nuevo ciclo con numeración automática
   * @param subscriptionId ID de la suscripción
   * @param cycleStart Fecha de inicio del ciclo
   * @param cycleEnd Fecha de fin del ciclo
   * @param paymentDueDate Fecha de vencimiento del pago (opcional)
   * @param totalAmount Monto total del ciclo (opcional)
   * @param notes Notas adicionales (opcional)
   * @returns El ciclo creado
   */
  async createCycleWithAutoNumbering(
    subscriptionId: number,
    cycleStart: Date,
    cycleEnd: Date,
    paymentDueDate?: Date,
    totalAmount?: number,
    notes?: string,
  ) {
    try {
      // Verificar que la suscripción existe
      const subscription = await this.prisma.customer_subscription.findUnique({
        where: { subscription_id: subscriptionId },
      });

      if (!subscription) {
        throw new Error(`Suscripción ${subscriptionId} no encontrada`);
      }

      // Obtener el siguiente número de ciclo
      const nextCycleNumber = await this.getNextCycleNumber(subscriptionId);

      // Verificar que no existe un ciclo con el mismo número (por seguridad)
      const existingCycle = await this.prisma.subscription_cycle.findUnique({
        where: {
          subscription_id_cycle_number: {
            subscription_id: subscriptionId,
            cycle_number: nextCycleNumber,
          },
        },
      });

      if (existingCycle) {
        throw new Error(
          `Ya existe un ciclo ${nextCycleNumber} para la suscripción ${subscriptionId}`,
        );
      }

      // Crear el nuevo ciclo
      const newCycle = await this.prisma.subscription_cycle.create({
        data: {
          subscription_id: subscriptionId,
          cycle_number: nextCycleNumber,
          cycle_start: cycleStart,
          cycle_end: cycleEnd,
          payment_due_date: paymentDueDate,
          total_amount: totalAmount,
          notes: notes,
          payment_status: PaymentStatus.PENDING,
          is_overdue: false,
          late_fee_applied: false,
          paid_amount: 0,
          pending_balance: totalAmount || 0,
          credit_balance: 0,
        },
        include: {
          customer_subscription: {
            include: {
              person: true,
            },
          },
        },
      });

      return newCycle;
    } catch (error) {
      console.error('Error creando ciclo con numeración automática:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los ciclos de una suscripción ordenados por número
   * @param subscriptionId ID de la suscripción
   * @param includeDetails Si incluir detalles del ciclo
   * @returns Lista de ciclos ordenados
   */
  async getCyclesBySubscription(
    subscriptionId: number,
    includeDetails: boolean = false,
  ) {
    try {
      const include: any = {
        customer_subscription: {
          include: {
            person: true,
          },
        },
      };

      if (includeDetails) {
        include.subscription_cycle_detail = {
          include: {
            product: true,
          },
        };
        include.cycle_payments = true;
      }

      return this.prisma.subscription_cycle.findMany({
        where: {
          subscription_id: subscriptionId,
        },
        include,
        orderBy: {
          cycle_number: 'asc',
        },
      });
    } catch (error) {
      console.error(
        `Error obteniendo ciclos para suscripción ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtiene un ciclo específico por suscripción y número de ciclo
   * @param subscriptionId ID de la suscripción
   * @param cycleNumber Número del ciclo
   * @param includeDetails Si incluir detalles del ciclo
   * @returns El ciclo encontrado o null
   */
  async getCycleByNumber(
    subscriptionId: number,
    cycleNumber: number,
    includeDetails: boolean = false,
  ) {
    try {
      const include: any = {
        customer_subscription: {
          include: {
            person: true,
          },
        },
      };

      if (includeDetails) {
        include.subscription_cycle_detail = {
          include: {
            product: true,
          },
        };
        include.cycle_payments = true;
      }

      return this.prisma.subscription_cycle.findUnique({
        where: {
          subscription_id_cycle_number: {
            subscription_id: subscriptionId,
            cycle_number: cycleNumber,
          },
        },
        include,
      });
    } catch (error) {
      console.error(
        `Error obteniendo ciclo ${cycleNumber} para suscripción ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtiene el ciclo actual (más reciente) de una suscripción
   * @param subscriptionId ID de la suscripción
   * @param includeDetails Si incluir detalles del ciclo
   * @returns El ciclo actual o null si no hay ciclos
   */
  async getCurrentCycle(
    subscriptionId: number,
    includeDetails: boolean = false,
  ) {
    try {
      const include: any = {
        customer_subscription: {
          include: {
            person: true,
          },
        },
      };

      if (includeDetails) {
        include.subscription_cycle_detail = {
          include: {
            product: true,
          },
        };
        include.cycle_payments = true;
      }

      return this.prisma.subscription_cycle.findFirst({
        where: {
          subscription_id: subscriptionId,
        },
        include,
        orderBy: {
          cycle_number: 'desc',
        },
      });
    } catch (error) {
      console.error(
        `Error obteniendo ciclo actual para suscripción ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Valida la secuencia de numeración de ciclos para una suscripción
   * @param subscriptionId ID de la suscripción
   * @returns Objeto con el resultado de la validación
   */
  async validateCycleSequence(subscriptionId: number) {
    try {
      const cycles = await this.prisma.subscription_cycle.findMany({
        where: {
          subscription_id: subscriptionId,
        },
        select: {
          cycle_id: true,
          cycle_number: true,
        },
        orderBy: {
          cycle_number: 'asc',
        },
      });

      const issues: string[] = [];
      let isValid = true;

      if (cycles.length === 0) {
        return {
          isValid: true,
          issues: [],
          totalCycles: 0,
          message: 'No hay ciclos para validar',
        };
      }

      // Verificar que la secuencia empiece en 1
      if (cycles[0].cycle_number !== 1) {
        isValid = false;
        issues.push(
          `La secuencia no empieza en 1, empieza en ${cycles[0].cycle_number}`,
        );
      }

      // Verificar que no haya saltos en la secuencia
      for (let i = 1; i < cycles.length; i++) {
        const expectedNumber = cycles[i - 1].cycle_number + 1;
        if (cycles[i].cycle_number !== expectedNumber) {
          isValid = false;
          issues.push(
            `Salto en la secuencia: después del ciclo ${cycles[i - 1].cycle_number} viene el ${cycles[i].cycle_number}, se esperaba ${expectedNumber}`,
          );
        }
      }

      // Verificar que no haya duplicados
      const cycleNumbers = cycles.map((c) => c.cycle_number);
      const uniqueNumbers = [...new Set(cycleNumbers)];
      if (cycleNumbers.length !== uniqueNumbers.length) {
        isValid = false;
        issues.push('Existen números de ciclo duplicados');
      }

      return {
        isValid,
        issues,
        totalCycles: cycles.length,
        expectedNextNumber:
          cycles.length > 0 ? Math.max(...cycleNumbers) + 1 : 1,
        message: isValid
          ? 'La secuencia de ciclos es válida'
          : 'Se encontraron problemas en la secuencia',
      };
    } catch (error) {
      console.error(
        `Error validando secuencia de ciclos para suscripción ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Repara la secuencia de numeración de ciclos (usar con precaución)
   * @param subscriptionId ID de la suscripción
   * @param dryRun Si true, solo simula los cambios sin aplicarlos
   * @returns Resultado de la reparación
   */
  async repairCycleSequence(subscriptionId: number, dryRun: boolean = true) {
    try {
      const cycles = await this.prisma.subscription_cycle.findMany({
        where: {
          subscription_id: subscriptionId,
        },
        orderBy: [{ cycle_start: 'asc' }, { cycle_id: 'asc' }],
      });

      if (cycles.length === 0) {
        return {
          success: true,
          changes: [],
          message: 'No hay ciclos para reparar',
        };
      }

      const changes: Array<{
        cycleId: number;
        oldNumber: number;
        newNumber: number;
      }> = [];

      // Renumerar secuencialmente
      for (let i = 0; i < cycles.length; i++) {
        const newNumber = i + 1;
        if (cycles[i].cycle_number !== newNumber) {
          changes.push({
            cycleId: cycles[i].cycle_id,
            oldNumber: cycles[i].cycle_number,
            newNumber: newNumber,
          });
        }
      }

      if (changes.length === 0) {
        return {
          success: true,
          changes: [],
          message: 'La secuencia ya es correcta, no se necesitan cambios',
        };
      }

      if (!dryRun) {
        // Aplicar los cambios
        for (const change of changes) {
          await this.prisma.subscription_cycle.update({
            where: { cycle_id: change.cycleId },
            data: { cycle_number: change.newNumber },
          });
        }
      }

      return {
        success: true,
        changes,
        message: dryRun
          ? `Se encontraron ${changes.length} cambios necesarios (simulación)`
          : `Se aplicaron ${changes.length} cambios exitosamente`,
      };
    } catch (error) {
      console.error(
        `Error reparando secuencia de ciclos para suscripción ${subscriptionId}:`,
        error,
      );
      throw error;
    }
  }
}
