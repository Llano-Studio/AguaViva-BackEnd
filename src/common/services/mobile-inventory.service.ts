import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateVehicleRouteInventoryDto,
  VehicleRouteInventoryResponseDto,
  VehicleInventoryItemResponseDto,
  InventoryTransactionDto } from '../../route-sheet/dto/vehicle-inventory.dto';
import { DeliveryStatus } from '../../common/constants/enums';
import { PrismaBackedService } from '../../prisma/prisma-backed.service';
import { PrismaService } from '../../prisma/prisma.service';


interface InventoryItemWithProduct {
  inventory_id: number;
  route_sheet_id: number;
  product_id: number;
  initial_quantity: number;
  current_quantity: number;
  returned_quantity: number;
  product: {
    product_id: number;
    description: string;
    [key: string]: any;
  };
}

@Injectable()
export class MobileInventoryService extends PrismaBackedService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Inicializa el inventario para una hoja de ruta
   */
  async initializeRouteInventory(
    createDto: CreateVehicleRouteInventoryDto,
  ): Promise<VehicleRouteInventoryResponseDto> {
    const { route_sheet_id, items } = createDto;

    try {
      // 1. Verificar que la hoja de ruta existe
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id },
        include: {
          vehicle_route_inventory: true } });

      if (!routeSheet) {
        throw new NotFoundException(
          `Hoja de ruta con ID ${route_sheet_id} no encontrada`,
        );
      }

      // 2. Verificar si ya existe inventario para esta hoja de ruta
      if (routeSheet.vehicle_route_inventory.length > 0) {
        throw new BadRequestException(
          `Ya existe inventario para la hoja de ruta ${route_sheet_id}`,
        );
      }

      // 3. Crear el inventario inicial en una transacción
      const result = await this.$transaction(async (tx) => {
        const inventoryItems: InventoryItemWithProduct[] = [];

        // Crear cada ítem de inventario
        for (const item of items) {
          // Verificar que el producto existe
          const product = await tx.product.findUnique({
            where: { product_id: item.product_id } });

          if (!product) {
            throw new BadRequestException(
              `El producto con ID ${item.product_id} no existe`,
            );
          }

          // Crear el ítem de inventario
          const inventoryItem = await tx.vehicle_route_inventory.create({
            data: {
              route_sheet_id,
              product_id: item.product_id,
              initial_quantity: item.initial_quantity,
              current_quantity: item.current_quantity || item.initial_quantity,
              returned_quantity: item.returned_quantity || 0 },
            include: {
              product: true } });

          // Registrar la transacción de carga inicial
          await tx.inventory_transaction.create({
            data: {
              route_sheet_id,
              product_id: item.product_id,
              quantity: item.initial_quantity,
              transaction_type: 'LOAD' } });

          inventoryItems.push(
            inventoryItem as unknown as InventoryItemWithProduct,
          );
        }

        return inventoryItems;
      });

      // 4. Transformar el resultado para la respuesta
      const responseItems: VehicleInventoryItemResponseDto[] = result.map(
        (item) => ({
          inventory_id: item.inventory_id,
          product: {
            product_id: item.product.product_id,
            description: item.product.description },
          initial_quantity: item.initial_quantity,
          current_quantity: item.current_quantity,
          returned_quantity: item.returned_quantity }),
      );

      return new VehicleRouteInventoryResponseDto({
        route_sheet_id,
        items: responseItems });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Error al inicializar inventario:', error);
      throw new InternalServerErrorException('Error al inicializar inventario');
    }
  }

  /**
   * Registra una transacción de inventario (carga, entrega o devolución).
   *
   * El descuento de stock se hace con una actualización condicional dentro de la
   * transacción, para que dos solicitudes simultáneas nunca dejen el inventario
   * en negativo. Las entregas llevan una clave de origen única: si el dispositivo
   * reintenta una entrega ya registrada, el segundo intento no vuelve a descontar.
   */
  async registerInventoryTransaction(
    transactionDto: InventoryTransactionDto,
  ): Promise<VehicleRouteInventoryResponseDto> {
    const {
      route_sheet_id,
      detail_id,
      product_id,
      quantity,
      transaction_type } = transactionDto;

    const amount = Math.abs(quantity);
    const originKey =
      transaction_type === 'DELIVERY' && detail_id
        ? `DELIVERY:${detail_id}:${product_id}`
        : null;

    try {
      await this.$transaction(async (tx) => {
        await this.applyInventoryMovement(
          tx,
          { route_sheet_id, product_id, amount, transaction_type },
        );

        await tx.inventory_transaction.create({
          data: {
            route_sheet_id,
            detail_id,
            product_id,
            quantity: transaction_type === 'DELIVERY' ? -amount : amount,
            transaction_type,
            origin_key: originKey } });

        if (transaction_type === 'DELIVERY' && detail_id) {
          await this.applyDeliveredQuantity(tx, detail_id, product_id, amount);
        }
      });

      return this.getRouteInventory(route_sheet_id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // El movimiento ya estaba registrado: se devuelve el estado actual sin
        // volver a descontar.
        return this.getRouteInventory(route_sheet_id);
      }
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      console.error('Error al registrar transacción de inventario:', error);
      throw new InternalServerErrorException(
        'Error al registrar transacción de inventario',
      );
    }
  }

  /** Aplica el efecto de la transacción sobre el stock cargado en el camión. */
  private async applyInventoryMovement(
    tx: Prisma.TransactionClient,
    movement: {
      route_sheet_id: number;
      product_id: number;
      amount: number;
      transaction_type: 'LOAD' | 'DELIVERY' | 'RETURN';
    },
  ): Promise<void> {
    const { route_sheet_id, product_id, amount, transaction_type } = movement;

    if (transaction_type === 'DELIVERY') {
      // El filtro `current_quantity >= amount` hace que el descuento sea
      // atómico: si no alcanza, no se actualiza ninguna fila.
      const updated = await tx.vehicle_route_inventory.updateMany({
        where: {
          route_sheet_id,
          product_id,
          current_quantity: { gte: amount } },
        data: { current_quantity: { decrement: amount } } });

      if (updated.count === 0) {
        await this.assertInventoryExists(tx, route_sheet_id, product_id);
        throw new BadRequestException(
          `No hay suficiente inventario para entregar ${amount} unidades`,
        );
      }
      return;
    }

    const updated = await tx.vehicle_route_inventory.updateMany({
      where: { route_sheet_id, product_id },
      data:
        transaction_type === 'RETURN'
          ? { returned_quantity: { increment: amount } }
          : { current_quantity: { increment: amount } } });

    if (updated.count === 0) {
      await this.assertInventoryExists(tx, route_sheet_id, product_id);
    }
  }

  private async assertInventoryExists(
    tx: Prisma.TransactionClient,
    routeSheetId: number,
    productId: number,
  ): Promise<void> {
    const inventory = await tx.vehicle_route_inventory.findFirst({
      where: { route_sheet_id: routeSheetId, product_id: productId },
      select: { inventory_id: true } });
    if (!inventory) {
      throw new NotFoundException(
        `No se encontró inventario para el producto ${productId} en la hoja de ruta ${routeSheetId}`,
      );
    }
  }

  /** Refleja la entrega en las cantidades entregadas del pedido o compra puntual. */
  private async applyDeliveredQuantity(
    tx: Prisma.TransactionClient,
    detailId: number,
    productId: number,
    amount: number,
  ): Promise<void> {
    const detail = await tx.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: detailId },
      include: {
        order_header: {
          include: { order_item: { where: { product_id: productId } } } },
        one_off_purchase: true } });

    if (!detail) return;

    const orderItem = detail.order_header?.order_item[0];
    if (orderItem) {
      await tx.order_item.update({
        where: { order_item_id: orderItem.order_item_id },
        data: {
          delivered_quantity:
            (orderItem.delivered_quantity || 0) + amount } });
      return;
    }

    const purchase = detail.one_off_purchase;
    if (purchase && purchase.product_id === productId) {
      await tx.one_off_purchase.update({
        where: { purchase_id: purchase.purchase_id },
        data: {
          delivered_quantity: (purchase.delivered_quantity || 0) + amount } });
    }
    // Las compras puntuales con encabezado no tienen delivered_quantity por línea.
  }

  /**
   * Obtiene el inventario actual de un vehículo en una ruta
   */
  async getRouteInventory(
    route_sheet_id: number,
  ): Promise<VehicleRouteInventoryResponseDto> {
    try {
      const inventoryItems = await this.vehicle_route_inventory.findMany({
        where: { route_sheet_id },
        include: {
          product: true } });

      if (inventoryItems.length === 0) {
        throw new NotFoundException(
          `No se encontró inventario para la hoja de ruta ${route_sheet_id}`,
        );
      }

      const responseItems: VehicleInventoryItemResponseDto[] =
        inventoryItems.map((item) => ({
          inventory_id: item.inventory_id,
          product: {
            product_id: item.product.product_id,
            description: item.product.description },
          initial_quantity: item.initial_quantity,
          current_quantity: item.current_quantity,
          returned_quantity: item.returned_quantity }));

      return new VehicleRouteInventoryResponseDto({
        route_sheet_id,
        items: responseItems });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error al obtener inventario:', error);
      throw new InternalServerErrorException('Error al obtener inventario');
    }
  }

  /**
   * Verifica si hay alertas de inventario bajo
   */
  async checkLowInventoryAlerts(route_sheet_id: number): Promise<any> {
    try {
      const inventoryItems = await this.vehicle_route_inventory.findMany({
        where: { route_sheet_id },
        include: {
          product: true,
          route_sheet: {
            include: {
              route_sheet_detail: {
                include: {
                  order_header: {
                    include: {
                      order_item: true } },
                  one_off_purchase: true,
                  one_off_purchase_header: {
                    include: {
                      purchase_items: true } } } } } } } });

      // Calcular inventario necesario para completar las entregas pendientes
      const alerts: Array<{
        product_id: number;
        product_description: string;
        current_quantity: number;
        required_quantity: number;
        shortage: number;
      }> = [];

      for (const item of inventoryItems) {
        let requiredQuantity = 0;

        // Sumar las cantidades necesarias de las entregas pendientes
        for (const detail of item.route_sheet.route_sheet_detail) {
          if (detail.delivery_status === DeliveryStatus.PENDING) {
            if (detail.order_header) {
              const orderItems = detail.order_header.order_item.filter(
                (oi) => oi.product_id === item.product_id,
              );
              for (const orderItem of orderItems) {
                requiredQuantity +=
                  orderItem.quantity - (orderItem.delivered_quantity || 0);
              }
            } else if (
              detail.one_off_purchase &&
              detail.one_off_purchase.product_id === item.product_id
            ) {
              requiredQuantity +=
                detail.one_off_purchase.quantity -
                (detail.one_off_purchase.delivered_quantity || 0);
            } else if (detail.one_off_purchase_header) {
              const purchaseItems =
                detail.one_off_purchase_header.purchase_items.filter(
                  (oi) => oi.product_id === item.product_id,
                );
              for (const purchaseItem of purchaseItems) {
                requiredQuantity += purchaseItem.quantity; // Los purchase_items no tienen delivered_quantity
              }
            }
          }
        }

        // Verificar si el inventario actual es suficiente
        if (item.current_quantity < requiredQuantity) {
          alerts.push({
            product_id: item.product_id,
            product_description: item.product.description,
            current_quantity: item.current_quantity,
            required_quantity: requiredQuantity,
            shortage: requiredQuantity - item.current_quantity });
        }
      }

      return {
        route_sheet_id,
        has_alerts: alerts.length > 0,
        alerts };
    } catch (error) {
      console.error('Error al verificar alertas de inventario:', error);
      throw new InternalServerErrorException(
        'Error al verificar alertas de inventario',
      );
    }
  }
}
