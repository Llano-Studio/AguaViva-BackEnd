import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import { BUSINESS_CONFIG, PaymentSemaphoreStatus } from '../config/business.config';

interface PaymentSemaphoreCache {
  [personId: number]: {
    status: PaymentSemaphoreStatus;
    lastUpdated: Date;
    expiresAt: Date;
  };
}

@Injectable()
export class PaymentSemaphoreService extends PrismaClient implements OnModuleInit {
  private cache: PaymentSemaphoreCache = {};
  private readonly cacheTtlMinutes: number;
  private readonly yellowThresholdDays: number;
  private readonly redThresholdDays: number;

  constructor(private readonly configService: ConfigService) {
    super();
    // Usar configuración centralizada con fallback a BUSINESS_CONFIG
    this.cacheTtlMinutes = this.configService.get('app.paymentSemaphore.cacheTtlMinutes') || 30;
    this.yellowThresholdDays = this.configService.get('app.paymentSemaphore.yellowThresholdDays') || BUSINESS_CONFIG.PAYMENT_SEMAPHORE.YELLOW_THRESHOLD_DAYS;
    this.redThresholdDays = this.configService.get('app.paymentSemaphore.redThresholdDays') || BUSINESS_CONFIG.PAYMENT_SEMAPHORE.RED_THRESHOLD_DAYS;
  }

  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Calcula el estado del semáforo de pagos para una persona específica
   */
  async calculatePaymentSemaphoreStatus(personId: number): Promise<PaymentSemaphoreStatus> {
    try {
      const activeSubscription = await this.customer_subscription.findFirst({
        where: {
          customer_id: personId,
          status: SubscriptionStatus.ACTIVE
        },
        orderBy: {
          start_date: 'desc'
        },
        include: {
          subscription_cycle: {
            orderBy: {
              cycle_end: 'desc'
            },
            take: 1
          }
        },
      });

      if (!activeSubscription?.subscription_cycle?.length) return 'NONE';

      const lastCycle = activeSubscription.subscription_cycle[0];
      const cycleEndDate = new Date(lastCycle.cycle_end);
      const today = new Date(); 
      today.setHours(0, 0, 0, 0);

      if (cycleEndDate < today) {
        const diffTime = today.getTime() - cycleEndDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > this.redThresholdDays) return 'RED';
        if (diffDays > this.yellowThresholdDays) return 'YELLOW';
        return 'GREEN';
      }
      
      return 'GREEN'; // Ciclo no vencido
    } catch (error) {
      console.error(`Error calculando el semáforo para la persona ${personId}:`, error);
      return 'NONE';
    }
  }

  /**
   * Obtiene el estado del semáforo con cache
   */
  async getPaymentSemaphoreStatus(personId: number, useCache: boolean = true): Promise<PaymentSemaphoreStatus> {
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
  async preCalculateForPersons(personIds: number[]): Promise<Map<number, PaymentSemaphoreStatus>> {
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
    Object.keys(this.cache).forEach(personIdStr => {
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
    const expiresAt = new Date(now.getTime() + this.cacheTtlMinutes * 60 * 1000);
    
    this.cache[personId] = {
      status,
      lastUpdated: now,
      expiresAt
    };
  }

  /**
   * Obtiene estadísticas del cache
   */
  getCacheStats(): { totalEntries: number; validEntries: number; expiredEntries: number } {
    const now = new Date();
    const totalEntries = Object.keys(this.cache).length;
    let validEntries = 0;
    let expiredEntries = 0;

    Object.values(this.cache).forEach(entry => {
      if (entry.expiresAt > now) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    });

    return { totalEntries, validEntries, expiredEntries };
  }
} 