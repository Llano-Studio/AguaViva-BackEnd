import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { formatBAYMD } from '../utils/date.utils';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaBackedService } from '../../prisma/prisma-backed.service';
import { PrismaService } from '../../prisma/prisma.service';


@Injectable()
export class FailedOrderReassignmentService
  extends PrismaBackedService
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly logger = new Logger(FailedOrderReassignmentService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('FailedOrderReassignmentService initialized');
  }

  /**
   * Ejecuta la reasignación automática de pedidos fallidos cada día a las 2 AM
   * @deprecated Esta función se ejecuta ahora mediante cron del sistema invocando forceReassignmentCheck
   */
  // Cron decorator removed in favor of system cron
  async reassignFailedOrders() {
    this.logger.log(
      '🔄 Iniciando reasignación automática de pedidos fallidos...',
    );

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Buscar detalles de hoja de ruta con estado FAILED de días anteriores
      const failedDeliveries = await this.route_sheet_detail.findMany({
        where: {
          delivery_status: 'FAILED',
          reschedule_date: null, // Solo los que no han sido reprogramados
          route_sheet: {
            delivery_date: {
              lt: today, // Entregas fallidas de días anteriores
            } } },
        include: {
          route_sheet: {
            include: {
              driver: true,
              vehicle: true } },
          order_header: {
            include: {
              customer: true,
              order_item: {
                include: {
                  product: true } } } },
          one_off_purchase: {
            include: {
              product: true } },
          one_off_purchase_header: {
            include: {
              person: true } } } });

      this.logger.log(
        `📊 Encontradas ${failedDeliveries.length} entregas fallidas para reasignar`,
      );

      for (const failedDelivery of failedDeliveries) {
        await this.processFailedDelivery(failedDelivery);
      }

      this.logger.log(
        '✅ Reasignación automática de pedidos fallidos completada',
      );
    } catch (error) {
      this.logger.error(
        '❌ Error durante la reasignación automática de pedidos fallidos:',
        error,
      );
    }
  }

  /**
   * Procesa una entrega fallida individual
   */
  private async processFailedDelivery(failedDelivery: any) {
    try {
      // Calcular la nueva fecha de entrega (siguiente día hábil)
      const newDeliveryDate = this.getNextBusinessDay(new Date());

      // Buscar una hoja de ruta existente para la nueva fecha
      let targetRouteSheet = await this.route_sheet.findFirst({
        where: {
          delivery_date: newDeliveryDate,
          // Preferir la misma zona si es posible
          vehicle: {
            vehicle_zone: {
              some: {
                is_active: true } } } },
        include: {
          driver: true,
          vehicle: true,
          route_sheet_detail: true } });

      // Si no existe una hoja de ruta para esa fecha, crear una nueva
      if (!targetRouteSheet) {
        targetRouteSheet = await this.createNewRouteSheet(
          newDeliveryDate,
          failedDelivery,
        );
      }

      // Reasignar el pedido a la nueva hoja de ruta
      await this.reassignToNewRouteSheet(
        failedDelivery,
        targetRouteSheet,
        newDeliveryDate,
      );

      this.logger.log(
        `✅ Pedido reasignado: ${this.getOrderIdentifier(failedDelivery)} ` +
          `de ${formatBAYMD(failedDelivery.route_sheet.delivery_date)} ` +
          `a ${formatBAYMD(newDeliveryDate as any)}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error procesando entrega fallida ${this.getOrderIdentifier(failedDelivery)}:`,
        error,
      );
    }
  }

  /**
   * Crea una nueva hoja de ruta para la fecha especificada
   */
  private async createNewRouteSheet(deliveryDate: Date, failedDelivery: any) {
    // Buscar un conductor y vehículo disponible
    const availableDriver = await this.user.findFirst({
      where: {
        role: 'DRIVERS',
        isActive: true,
        user_vehicle: {
          some: {
            is_active: true } } },
      include: {
        user_vehicle: {
          where: { is_active: true },
          include: {
            vehicle: true } } } });

    if (!availableDriver || !availableDriver.user_vehicle[0]) {
      throw new Error(
        'No hay conductores o vehículos disponibles para crear nueva hoja de ruta',
      );
    }

    const vehicle = availableDriver.user_vehicle[0].vehicle;

    return await this.route_sheet.create({
      data: {
        delivery_date: deliveryDate,
        driver_id: availableDriver.id,
        vehicle_id: vehicle.vehicle_id,
        route_notes:
          'Hoja de ruta creada automáticamente para reasignación de pedidos fallidos' },
      include: {
        driver: true,
        vehicle: true,
        route_sheet_detail: true } });
  }

  /**
   * Reasigna el pedido fallido a una nueva hoja de ruta
   */
  private async reassignToNewRouteSheet(
    failedDelivery: any,
    targetRouteSheet: any,
    newDeliveryDate: Date,
  ) {
    await this.$transaction(async (tx) => {
      // Marcar la entrega original como reprogramada
      await tx.route_sheet_detail.update({
        where: { route_sheet_detail_id: failedDelivery.route_sheet_detail_id },
        data: {
          reschedule_date: newDeliveryDate,
          comments:
            (failedDelivery.comments || '') +
            ' | Reprogramado automáticamente por falla en entrega' } });

      // Crear nueva entrada en la hoja de ruta destino
      await tx.route_sheet_detail.create({
        data: {
          route_sheet_id: targetRouteSheet.route_sheet_id,
          order_id: failedDelivery.order_id,
          one_off_purchase_id: failedDelivery.one_off_purchase_id,
          one_off_purchase_header_id: failedDelivery.one_off_purchase_header_id,
          delivery_status: 'PENDING',
          comments: 'Reasignado automáticamente desde entrega fallida' } });

      // Actualizar la fecha de entrega programada del pedido si es un pedido de suscripción
      if (failedDelivery.order_id) {
        await tx.order_header.update({
          where: { order_id: failedDelivery.order_id },
          data: {
            scheduled_delivery_date: newDeliveryDate } });
      }
    });
  }

  /**
   * Obtiene el siguiente día hábil
   */
  private getNextBusinessDay(fromDate: Date): Date {
    const date = new Date(fromDate);
    date.setDate(date.getDate() + 1);

    // Si es sábado (6) o domingo (0), avanzar al lunes
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() + 1);
    }

    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Obtiene un identificador legible del pedido
   */
  private getOrderIdentifier(failedDelivery: any): string {
    if (failedDelivery.order_id) {
      return `Pedido de suscripción ${failedDelivery.order_id}`;
    } else if (failedDelivery.one_off_purchase_id) {
      return `Compra one-off ${failedDelivery.one_off_purchase_id}`;
    } else if (failedDelivery.one_off_purchase_header_id) {
      return `Header de compra one-off ${failedDelivery.one_off_purchase_header_id}`;
    }
    return `Pedido desconocido ${failedDelivery.route_sheet_detail_id}`;
  }

  /**
   * Método manual para forzar la reasignación de pedidos fallidos (útil para testing)
   */
  async forceReassignmentCheck() {
    this.logger.log('🔧 Ejecutando reasignación manual de pedidos fallidos...');
    await this.reassignFailedOrders();
  }

  /**
   * Obtiene estadísticas de pedidos fallidos
   */
  async getFailedOrdersStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const failedCount = await this.route_sheet_detail.count({
      where: {
        delivery_status: 'FAILED',
        reschedule_date: null,
        route_sheet: {
          delivery_date: {
            lt: today } } } });

    const rescheduledCount = await this.route_sheet_detail.count({
      where: {
        delivery_status: 'FAILED',
        reschedule_date: { not: null },
        route_sheet: {
          delivery_date: {
            lt: today } } } });

    return {
      pending_reassignment: failedCount,
      already_rescheduled: rescheduledCount,
      total_failed: failedCount + rescheduledCount };
  }
}
