import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { 
  CreateVehicleRouteInventoryDto, 
  VehicleRouteInventoryResponseDto, 
  VehicleInventoryItemResponseDto,
  InventoryTransactionDto
} from '../dto/vehicle-inventory.dto';

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
export class MobileInventoryService extends PrismaClient {
  
  /**
   * Inicializa el inventario para una hoja de ruta
   */
  async initializeRouteInventory(createDto: CreateVehicleRouteInventoryDto): Promise<VehicleRouteInventoryResponseDto> {
    const { route_sheet_id, items } = createDto;

    try {
      // 1. Verificar que la hoja de ruta existe
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id },
        include: {
          vehicle_route_inventory: true
        }
      });

      if (!routeSheet) {
        throw new NotFoundException(`Hoja de ruta con ID ${route_sheet_id} no encontrada`);
      }

      // 2. Verificar si ya existe inventario para esta hoja de ruta
      if (routeSheet.vehicle_route_inventory.length > 0) {
        throw new BadRequestException(`Ya existe inventario para la hoja de ruta ${route_sheet_id}`);
      }

      // 3. Crear el inventario inicial en una transacción
      const result = await this.$transaction(async (tx) => {
        const inventoryItems: InventoryItemWithProduct[] = [];

        // Crear cada ítem de inventario
        for (const item of items) {
          // Verificar que el producto existe
          const product = await tx.product.findUnique({
            where: { product_id: item.product_id }
          });

          if (!product) {
            throw new BadRequestException(`El producto con ID ${item.product_id} no existe`);
          }

          // Crear el ítem de inventario
          const inventoryItem = await tx.vehicle_route_inventory.create({
            data: {
              route_sheet_id,
              product_id: item.product_id,
              initial_quantity: item.initial_quantity,
              current_quantity: item.current_quantity || item.initial_quantity,
              returned_quantity: item.returned_quantity || 0
            },
            include: {
              product: true
            }
          });

          // Registrar la transacción de carga inicial
          await tx.inventory_transaction.create({
            data: {
              route_sheet_id,
              product_id: item.product_id,
              quantity: item.initial_quantity,
              transaction_type: 'LOAD'
            }
          });

          inventoryItems.push(inventoryItem as unknown as InventoryItemWithProduct);
        }

        return inventoryItems;
      });

      // 4. Transformar el resultado para la respuesta
      const responseItems: VehicleInventoryItemResponseDto[] = result.map(item => ({
        inventory_id: item.inventory_id,
        product: {
          product_id: item.product.product_id,
          description: item.product.description
        },
        initial_quantity: item.initial_quantity,
        current_quantity: item.current_quantity,
        returned_quantity: item.returned_quantity
      }));

      return new VehicleRouteInventoryResponseDto({
        route_sheet_id,
        items: responseItems
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error al inicializar inventario:', error);
      throw new InternalServerErrorException('Error al inicializar inventario');
    }
  }

  /**
   * Registra una transacción de inventario (entrega o devolución)
   */
  async registerInventoryTransaction(transactionDto: InventoryTransactionDto): Promise<VehicleRouteInventoryResponseDto> {
    const { route_sheet_id, detail_id, product_id, quantity, transaction_type } = transactionDto;

    try {
      // 1. Verificar que el inventario existe para esta hoja de ruta
      const routeInventory = await this.vehicle_route_inventory.findFirst({
        where: {
          route_sheet_id,
          product_id
        }
      });

      if (!routeInventory) {
        throw new NotFoundException(`No se encontró inventario para el producto ${product_id} en la hoja de ruta ${route_sheet_id}`);
      }

      // 2. Validar la transacción según su tipo
      if (transaction_type === 'DELIVERY' && (routeInventory.current_quantity < Math.abs(quantity))) {
        throw new BadRequestException(`No hay suficiente inventario para entregar ${Math.abs(quantity)} unidades`);
      }

      // 3. Actualizar el inventario en una transacción
      await this.$transaction(async (tx) => {
        // Actualizar el inventario del vehículo
        let updateData: Prisma.vehicle_route_inventoryUpdateInput = {};
        
        if (transaction_type === 'DELIVERY') {
          // Para entregas, reducimos el inventario actual
          updateData.current_quantity = routeInventory.current_quantity - Math.abs(quantity);
        } else if (transaction_type === 'RETURN') {
          // Para devoluciones, incrementamos el contador de devoluciones
          updateData.returned_quantity = routeInventory.returned_quantity + Math.abs(quantity);
        } else if (transaction_type === 'LOAD') {
          // Para cargas adicionales, incrementamos el inventario actual
          updateData.current_quantity = routeInventory.current_quantity + Math.abs(quantity);
        }

        await tx.vehicle_route_inventory.update({
          where: {
            inventory_id: routeInventory.inventory_id
          },
          data: updateData
        });

        // Registrar la transacción
        await tx.inventory_transaction.create({
          data: {
            route_sheet_id,
            detail_id,
            product_id,
            quantity: transaction_type === 'DELIVERY' ? -Math.abs(quantity) : Math.abs(quantity),
            transaction_type
          }
        });

        // Si es una entrega y hay un detalle asociado, actualizar las cantidades entregadas
        if (transaction_type === 'DELIVERY' && detail_id) {
          const detail = await tx.route_sheet_detail.findUnique({
            where: { route_sheet_detail_id: detail_id },
            include: {
              order_header: {
                include: {
                  order_item: {
                    where: { product_id }
                  }
                }
              },
              one_off_purchase: true,
              one_off_purchase_header: {
                include: {
                  purchase_items: {
                    where: { product_id }
                  }
                }
              }
            }
          });

          if (detail) {
            if (detail.order_header && detail.order_header.order_item.length > 0) {
              const orderItem = detail.order_header.order_item[0];
              
              await tx.order_item.update({
                where: { order_item_id: orderItem.order_item_id },
                data: {
                  delivered_quantity: (orderItem.delivered_quantity || 0) + Math.abs(quantity)
                }
              });
            } else if (detail.one_off_purchase && detail.one_off_purchase.product_id === product_id) {
               await tx.one_off_purchase.update({
                 where: { purchase_id: detail.one_off_purchase.purchase_id },
                 data: {
                   delivered_quantity: (detail.one_off_purchase.delivered_quantity || 0) + Math.abs(quantity)
                 }
               });
             } else if (detail.one_off_purchase_header && detail.one_off_purchase_header.purchase_items.length > 0) {
               const purchaseItem = detail.one_off_purchase_header.purchase_items[0];
               
               await tx.one_off_purchase_item.update({
                 where: { purchase_item_id: purchaseItem.purchase_item_id },
                 data: {
                   delivered_quantity: (purchaseItem.delivered_quantity || 0) + Math.abs(quantity)
                 }
               });
            }
          }
        }
      });

      // 4. Obtener y devolver el inventario actualizado
      return this.getRouteInventory(route_sheet_id);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error al registrar transacción de inventario:', error);
      throw new InternalServerErrorException('Error al registrar transacción de inventario');
    }
  }

  /**
   * Obtiene el inventario actual de un vehículo en una ruta
   */
  async getRouteInventory(route_sheet_id: number): Promise<VehicleRouteInventoryResponseDto> {
    try {
      const inventoryItems = await this.vehicle_route_inventory.findMany({
        where: { route_sheet_id },
        include: {
          product: true
        }
      });

      if (inventoryItems.length === 0) {
        throw new NotFoundException(`No se encontró inventario para la hoja de ruta ${route_sheet_id}`);
      }

      const responseItems: VehicleInventoryItemResponseDto[] = inventoryItems.map(item => ({
        inventory_id: item.inventory_id,
        product: {
          product_id: item.product.product_id,
          description: item.product.description
        },
        initial_quantity: item.initial_quantity,
        current_quantity: item.current_quantity,
        returned_quantity: item.returned_quantity
      }));

      return new VehicleRouteInventoryResponseDto({
        route_sheet_id,
        items: responseItems
      });
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
                      order_item: true
                    }
                  },
                  one_off_purchase: true,
                  one_off_purchase_header: {
                    include: {
                      purchase_items: true
                    }
                  }
                }
              }
            }
          }
        }
      });

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
          if (detail.delivery_status === 'PENDING') {
            if (detail.order_header) {
              const orderItems = detail.order_header.order_item.filter(oi => oi.product_id === item.product_id);
              for (const orderItem of orderItems) {
                requiredQuantity += orderItem.quantity - (orderItem.delivered_quantity || 0);
              }
            } else if (detail.one_off_purchase && detail.one_off_purchase.product_id === item.product_id) {
               requiredQuantity += detail.one_off_purchase.quantity - (detail.one_off_purchase.delivered_quantity || 0);
             } else if (detail.one_off_purchase_header) {
               const purchaseItems = detail.one_off_purchase_header.purchase_items.filter(oi => oi.product_id === item.product_id);
               for (const purchaseItem of purchaseItems) {
                 requiredQuantity += purchaseItem.quantity - (purchaseItem.delivered_quantity || 0);
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
            shortage: requiredQuantity - item.current_quantity
          });
        }
      }

      return {
        route_sheet_id,
        has_alerts: alerts.length > 0,
        alerts
      };
    } catch (error) {
      console.error('Error al verificar alertas de inventario:', error);
      throw new InternalServerErrorException('Error al verificar alertas de inventario');
    }
  }
}