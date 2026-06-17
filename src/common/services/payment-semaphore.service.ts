import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaBackedService } from '../../prisma/prisma-backed.service';
import { PrismaService } from '../../prisma/prisma.service';

import {
  BUSINESS_CONFIG,
  PaymentSemaphoreStatus } from '../config/business.config';

interface PaymentSemaphoreCache {
  [personId: number]: {
    status: PaymentSemaphoreStatus;
    lastUpdated: Date;
    expiresAt: Date;
  };
}

@Injectable()
export class PaymentSemaphoreService
  extends PrismaBackedService
{
  private cache: PaymentSemaphoreCache = {};
  private readonly cacheTtlMinutes: number;
  private readonly yellowThresholdDays: number;
  private readonly redThresholdDays: number;

  constructor(
    prisma: PrismaService,
    private readonly configService: ConfigService) {
    super(prisma);
    // Usar configuración centralizada con fallback a BUSINESS_CONFIG
    this.cacheTtlMinutes =
      this.configService.get('app.paymentSemaphore.cacheTtlMinutes') || 30;
    this.yellowThresholdDays =
      this.configService.get('app.paymentSemaphore.yellowThresholdDays') ||
      BUSINESS_CONFIG.PAYMENT_SEMAPHORE.YELLOW_THRESHOLD_DAYS;
    this.redThresholdDays =
      this.configService.get('app.paymentSemaphore.redThresholdDays') ||
      BUSINESS_CONFIG.PAYMENT_SEMAPHORE.RED_THRESHOLD_DAYS;
  }

  /**
   * Calcula el estado del semáforo de pagos para una persona específica
   * 🔧 CORRECCIÓN CRÍTICA: Ahora verifica TODOS los ciclos activos, no solo el último
   */
  async calculatePaymentSemaphoreStatus(
    personId: number,
  ): Promise<PaymentSemaphoreStatus> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const gracePeriodDays = 10;

      // 🔧 CAMBIO CRÍTICO: Obtener TODOS los ciclos activos del cliente, no solo el último
      // IMPORTANTE: Incluir ciclos terminados que aún tengan pagos pendientes
      const activeCycles = await this.subscription_cycle.findMany({
        where: {
          customer_subscription: {
            customer_id: personId,
            // Incluir suscripciones ACTIVAS y CANCELADAS que todavía tengan ciclos con deuda
            status: {
              in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED] } },
          // Incluir ciclos que:
          // 1. No han terminado (cycle_end >= today), O
          // 2. Han terminado pero tienen pagos pendientes (pending_balance > 0)
          OR: [
            { cycle_end: { gte: today } }, // Ciclos activos
            {
              cycle_end: { lt: today },
              pending_balance: { gt: 0 } }, // Ciclos terminados con deuda
          ] },
        include: {
          customer_subscription: {
            select: {
              subscription_id: true,
              start_date: true } } },
        orderBy: {
          cycle_end: 'desc' } });

      // Si no hay ciclos activos, retornar NONE
      if (!activeCycles || activeCycles.length === 0) return 'NONE';

      // 🔧 VALIDACIÓN CRÍTICA: Verificar el estado de TODOS los ciclos
      let hasAnyPendingOrPartial = false;
      let hasAnyOverdue = false;
      let hasAnyWithAmount = false;
      let earliestDueDate: Date | null = null;
      let maxOverdueDays = 0;

      for (const cycle of activeCycles) {
        const pendingBalance = parseFloat(
          cycle.pending_balance?.toString() || '0',
        );
        const totalAmount = parseFloat(cycle.total_amount?.toString() || '0');
        const paidAmount = parseFloat(cycle.paid_amount?.toString() || '0');
        const paymentDueDate = cycle.payment_due_date
          ? new Date(cycle.payment_due_date)
          : new Date(cycle.cycle_end);

        // Si hay monto total, marcar que tiene actividad
        if (totalAmount > 0) {
          hasAnyWithAmount = true;
        }

        // 🔧 VERIFICACIÓN CRÍTICA: Si algún ciclo tiene estado PENDING o PARTIAL, no puede ser GREEN
        if (
          cycle.payment_status === 'PENDING' ||
          cycle.payment_status === 'PARTIAL'
        ) {
          hasAnyPendingOrPartial = true;

          // Verificar si está vencido
          if (paymentDueDate < today) {
            const diffTime = today.getTime() - paymentDueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const effectiveOverdueDays = Math.max(
              0,
              diffDays - gracePeriodDays,
            );
            if (effectiveOverdueDays > 0) {
              hasAnyOverdue = true;
              maxOverdueDays = Math.max(maxOverdueDays, effectiveOverdueDays);
            }
          } else {
            // Rastrear la fecha de vencimiento más próxima
            if (!earliestDueDate || paymentDueDate < earliestDueDate) {
              earliestDueDate = paymentDueDate;
            }
          }
        }

        // También verificar si hay saldo pendiente (doble validación)
        if (pendingBalance > 0) {
          hasAnyPendingOrPartial = true;
          if (paymentDueDate < today) {
            const diffTime = today.getTime() - paymentDueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const effectiveOverdueDays = Math.max(
              0,
              diffDays - gracePeriodDays,
            );
            if (effectiveOverdueDays > 0) {
              hasAnyOverdue = true;
              maxOverdueDays = Math.max(maxOverdueDays, effectiveOverdueDays);
            }
          }
        }
      }

      // 🔧 LÓGICA CORREGIDA: Solo GREEN si TODOS los ciclos están completamente pagados
      if (!hasAnyPendingOrPartial && hasAnyWithAmount) {
        // Verificar que TODOS los ciclos tengan payment_status === 'PAID'
        const allCyclesPaid = activeCycles.every((cycle) => {
          const pendingBalance = parseFloat(
            cycle.pending_balance?.toString() || '0',
          );
          return cycle.payment_status === 'PAID' && pendingBalance === 0;
        });
        if (allCyclesPaid) {
          return 'GREEN';
        }
      }

      // Si hay pagos vencidos, determinar el color según los días de retraso
      if (hasAnyOverdue) {
        if (maxOverdueDays > this.redThresholdDays) return 'RED';
        if (maxOverdueDays > this.yellowThresholdDays) return 'YELLOW';
        return 'YELLOW'; // Por defecto YELLOW si hay vencidos pero no superan umbrales
      }

      // Si hay pagos pendientes pero no vencidos, es YELLOW
      if (hasAnyPendingOrPartial) {
        return 'YELLOW';
      }

      // 🔧 MANEJO DE SUSCRIPCIONES NUEVAS: Si no hay montos pero es reciente
      if (!hasAnyWithAmount) {
        // Obtener la suscripción más reciente para verificar si es nueva
        const latestSubscription = activeCycles[0]?.customer_subscription;
        if (latestSubscription) {
          const subscriptionStartDate = new Date(latestSubscription.start_date);
          const daysSinceStart = Math.ceil(
            (today.getTime() - subscriptionStartDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );

          // Si la suscripción fue creada hace menos de 30 días y no tiene montos calculados,
          // es probable que sea nueva y esté esperando confirmación de pago
          if (daysSinceStart <= 30) {
            return 'YELLOW';
          }
        }

        // Si es muy antigua sin montos, entonces es NONE
        return 'NONE';
      }

      // Caso por defecto
      return 'NONE';
    } catch (error) {
      console.error(
        `Error calculando el semáforo para la persona ${personId}:`,
        error,
      );
      return 'NONE';
    }
  }

  /**
   * Obtiene el estado del semáforo con cache
   */
  async getPaymentSemaphoreStatus(
    personId: number,
    useCache: boolean = true,
  ): Promise<PaymentSemaphoreStatus> {
    if (useCache && this.isCacheValid(personId)) {
      return this.cache[personId].status;
    }

    const status = await this.calculatePaymentSemaphoreStatus(personId);
    this.updateCache(personId, status);
    return status;
  }

  /**
   * Pre-calcula el semáforo para múltiples personas
   */
  async preCalculateForPersons(
    personIds: number[],
  ): Promise<Map<number, PaymentSemaphoreStatus>> {
    const results = new Map<number, PaymentSemaphoreStatus>();

    // Procesar en lotes para evitar sobrecarga
    const batchSize = 50;
    for (let i = 0; i < personIds.length; i += batchSize) {
      const batch = personIds.slice(i, i + batchSize);
      const batchPromises = batch.map(async (personId) => {
        const status = await this.calculatePaymentSemaphoreStatus(personId);
        this.updateCache(personId, status);
        return { personId, status };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ personId, status }) => {
        results.set(personId, status);
      });
    }

    return results;
  }

  /**
   * Invalida el cache para una persona específica
   */
  invalidateCache(personId: number): void {
    delete this.cache[personId];
  }

  /**
   * Invalida todo el cache
   */
  invalidateAllCache(): void {
    this.cache = {};
  }

  /**
   * Limpia entradas expiradas del cache
   */
  cleanExpiredCache(): void {
    const now = new Date();
    Object.keys(this.cache).forEach((personIdStr) => {
      const personId = parseInt(personIdStr);
      if (this.cache[personId].expiresAt < now) {
        delete this.cache[personId];
      }
    });
  }

  private isCacheValid(personId: number): boolean {
    const cached = this.cache[personId];
    return cached && cached.expiresAt > new Date();
  }

  private updateCache(personId: number, status: PaymentSemaphoreStatus): void {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.cacheTtlMinutes * 60 * 1000,
    );

    this.cache[personId] = {
      status,
      lastUpdated: now,
      expiresAt };
  }

  /**
   * Obtiene estadísticas del cache
   */
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
  } {
    const now = new Date();
    const totalEntries = Object.keys(this.cache).length;
    let validEntries = 0;
    let expiredEntries = 0;

    Object.values(this.cache).forEach((entry) => {
      if (entry.expiresAt > now) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    });

    return { totalEntries, validEntries, expiredEntries };
  }
}
