import { PrismaClient, RecoveryStatus, ComodatoStatus } from '@prisma/client';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

@Injectable()
export class RecoveryOrderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Crea una orden de recuperación automática para un comodato específico
   * @param comodatoId ID del comodato a recuperar
   * @param scheduledDate Fecha programada para la recuperación (opcional, por defecto 7 días)
   * @param notes Notas adicionales
   * @param tx Transacción opcional de Prisma
   * @returns La orden de recuperación creada
   */
async createRecoveryOrder(
    comodatoId: number,
    scheduledDate?: Date,
    notes?: string,
    tx?: any
  ) {
    // Si no se proporciona fecha, programar para 7 días después
    const defaultScheduledDate = scheduledDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const prisma = tx || this.prisma;

    try {
      // Verificar que el comodato existe y está activo
      const comodato = await prisma.comodato.findUnique({
        where: { comodato_id: comodatoId },
        include: {
          recovery_order: true,
          subscription: true
        }
      });

      if (!comodato) {
        throw new NotFoundException(`Comodato con ID ${comodatoId} no encontrado`);
      }

      if (comodato.status !== ComodatoStatus.ACTIVE || !comodato.is_active) {
        throw new BadRequestException(`El comodato ${comodatoId} no está activo`);
      }

      // Verificar si ya existe una orden de recuperación para este comodato
      const existingRecoveryOrder = await prisma.recovery_order.findUnique({
        where: { comodato_id: comodatoId },
      });

      if (existingRecoveryOrder) {
        throw new BadRequestException(`Ya existe una orden de recuperación para el comodato ${comodatoId}`);
      }

      // Crear la orden de recuperación
      const recoveryOrder = await prisma.recovery_order.create({
        data: {
          comodato_id: comodatoId,
          scheduled_recovery_date: defaultScheduledDate,
          status: RecoveryStatus.PENDING,
          notes: notes || `Orden de recuperación automática para comodato ${comodatoId}`
        }
      });

      // Actualizar fecha esperada de devolución en el comodato
      await this.prisma.comodato.update({
        where: { comodato_id: comodatoId },
        data: {
          expected_return_date: defaultScheduledDate
        }
      });

      return recoveryOrder;
    } catch (error) {
      console.error('Error creando orden de recuperación:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las órdenes de recuperación con filtros opcionales
   * @param status Estado de la orden (opcional)
   * @param subscriptionId ID de suscripción (opcional)
   * @returns Lista de órdenes de recuperación
   */
  async getRecoveryOrders(
    status?: RecoveryStatus,
    subscriptionId?: number
  ) {
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (subscriptionId) {
      where.comodato = {
        subscription_id: subscriptionId
      };
    }

    return this.prisma.recovery_order.findMany({
      where,
      include: {
        comodato: {
          include: {
            subscription: {
              include: {
                person: true,
                subscription_plan: true,
              },
            },
            product: true,
          },
        },
      },
      orderBy: {
        scheduled_recovery_date: 'asc'
      }
    });
  }

  /**
   * Actualiza el estado de una orden de recuperación
   * @param recoveryOrderId ID de la orden de recuperación
   * @param status Nuevo estado
   * @param actualRecoveryDate Fecha real de recuperación (opcional)
   * @param notes Notas adicionales (opcional)
   * @returns La orden actualizada
   */
  async updateRecoveryOrderStatus(
    recoveryOrderId: number,
    status: RecoveryStatus,
    actualRecoveryDate?: Date,
    notes?: string
  ) {
    const updateData: any = {
      status,
      updated_at: new Date()
    };

    if (actualRecoveryDate) {
      updateData.actual_recovery_date = actualRecoveryDate;
    }

    if (notes) {
      updateData.notes = notes;
    }

    // Si se completa la recuperación, marcar el comodato como devuelto
    if (status === RecoveryStatus.COMPLETED) {
      const recoveryOrder = await this.prisma.recovery_order.findUnique({
        where: { recovery_order_id: recoveryOrderId },
        include: { comodato: true }
      });

      if (recoveryOrder?.comodato && recoveryOrder.comodato.status === ComodatoStatus.ACTIVE) {
        await this.prisma.comodato.update({
          where: { comodato_id: recoveryOrder.comodato.comodato_id },
          data: {
            status: ComodatoStatus.RETURNED,
            return_date: actualRecoveryDate || new Date()
          }
        });
      }
    }

    return this.prisma.recovery_order.update({
      where: { recovery_order_id: recoveryOrderId },
      data: updateData,
      include: {
        comodato: {
          include: {
            subscription: true
          }
        }
      }
    });
  }

  /**
   * Reprograma una orden de recuperación
   * @param recoveryOrderId ID de la orden de recuperación
   * @param newScheduledDate Nueva fecha programada
   * @param reason Razón de la reprogramación
   * @returns La orden reprogramada
   */
  async rescheduleRecoveryOrder(
    recoveryOrderId: number,
    newScheduledDate: Date,
    reason?: string
  ) {
    const recoveryOrder = await this.prisma.recovery_order.findUnique({
      where: { recovery_order_id: recoveryOrderId }
    });

    if (!recoveryOrder) {
      throw new Error(`Orden de recuperación ${recoveryOrderId} no encontrada`);
    }

    if (recoveryOrder.status === RecoveryStatus.COMPLETED) {
      throw new Error('No se puede reprogramar una orden ya completada');
    }

    const updatedOrder = await this.prisma.recovery_order.update({
      where: { recovery_order_id: recoveryOrderId },
      data: {
        scheduled_recovery_date: newScheduledDate,
        status: RecoveryStatus.RESCHEDULED,
        notes: reason ? `${recoveryOrder.notes || ''} | Reprogramada: ${reason}` : recoveryOrder.notes
      },
      include: {
        comodato: true
      }
    });

    // Actualizar fecha esperada de devolución en el comodato asociado
    if (updatedOrder.comodato) {
      await this.prisma.comodato.update({
        where: {
          comodato_id: updatedOrder.comodato.comodato_id
        },
        data: {
          expected_return_date: newScheduledDate
        }
      });
    }

    return updatedOrder;
  }

  /**
   * Obtiene órdenes de recuperación pendientes para una fecha específica
   * @param date Fecha para buscar órdenes programadas
   * @returns Lista de órdenes programadas para esa fecha
   */
  async getRecoveryOrdersByDate(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.prisma.recovery_order.findMany({
      where: {
        scheduled_recovery_date: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: [RecoveryStatus.PENDING, RecoveryStatus.SCHEDULED]
        }
      },
      include: {
        comodato: {
          include: {
            subscription: {
              include: {
                person: true,
                subscription_plan: true,
              },
            },
            product: true,
          },
        },
      },
      orderBy: {
        scheduled_recovery_date: 'asc'
      }
    });
  }

  /**
   * Cancela una orden de recuperación
   * @param recoveryOrderId ID de la orden de recuperación
   * @param reason Razón de la cancelación
   * @returns La orden cancelada
   */
  async cancelRecoveryOrder(
    recoveryOrderId: number,
    reason?: string
  ) {
    const recoveryOrder = await this.prisma.recovery_order.findUnique({
      where: { recovery_order_id: recoveryOrderId }
    });

    if (!recoveryOrder) {
      throw new Error(`Orden de recuperación ${recoveryOrderId} no encontrada`);
    }

    if (recoveryOrder.status === RecoveryStatus.COMPLETED) {
      throw new Error('No se puede cancelar una orden ya completada');
    }

    // Limpiar fecha esperada de devolución del comodato asociado
    const recoveryOrderWithComodato = await this.prisma.recovery_order.findUnique({
      where: { recovery_order_id: recoveryOrderId },
      include: { comodato: true }
    });

    if (recoveryOrderWithComodato?.comodato) {
      await this.prisma.comodato.update({
        where: {
          comodato_id: recoveryOrderWithComodato.comodato.comodato_id
        },
        data: {
          expected_return_date: null
        }
      });
    }

    return this.prisma.recovery_order.update({
      where: { recovery_order_id: recoveryOrderId },
      data: {
        status: RecoveryStatus.CANCELLED,
        notes: reason ? `${recoveryOrder.notes || ''} | Cancelada: ${reason}` : recoveryOrder.notes,
        updated_at: new Date()
      }
    });
  }
}