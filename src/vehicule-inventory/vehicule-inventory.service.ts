import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CreateVehicleInventoryDto } from './dto/create-vehicule-inventory.dto';
import { UpdateVehicleInventoryDto } from './dto/update-vehicule-inventory.dto';

@Injectable()
export class VehicleInventoryService extends PrismaClient implements OnModuleInit {

  async onModuleInit() {
    await this.$connect();
  }

  private async validateVehicleExists(vehicleId: number) {
    const vehicle = await this.vehicle.findUnique({ where: { vehicle_id: vehicleId } });
    if (!vehicle) {
      throw new BadRequestException(`Vehículo con ID ${vehicleId} no encontrado.`);
    }
  }

  private async validateProductExists(productId: number) {
    const product = await this.product.findUnique({ where: { product_id: productId } });
    if (!product) {
      throw new BadRequestException(`Producto con ID ${productId} no encontrado.`);
    }
  }

  async createOrUpdateVehicleInventory(dto: CreateVehicleInventoryDto) {
    await this.validateVehicleExists(dto.vehicle_id);
    await this.validateProductExists(dto.product_id);

    try {
      return await this.vehicle_inventory.upsert({
        where: { 
          vehicle_id_product_id: { 
            vehicle_id: dto.vehicle_id, 
            product_id: dto.product_id 
          }
        },
        update: {
          quantity_loaded: dto.quantity_loaded,
          quantity_empty: dto.quantity_empty,
        },
        create: {
          vehicle_id: dto.vehicle_id,
          product_id: dto.product_id,
          quantity_loaded: dto.quantity_loaded,
          quantity_empty: dto.quantity_empty,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Error de conflicto al crear/actualizar el inventario del vehículo.');
      }
      throw new InternalServerErrorException('Error al crear o actualizar el inventario del vehículo.');
    }
  }

  async getAllVehicleInventory() {
    return this.vehicle_inventory.findMany({
      include: {
        vehicle: true,
        product: true,
      },
    });
  }

  async getVehicleInventoryById(vehicle_id: number, product_id: number) {
    const inv = await this.vehicle_inventory.findUnique({
      where: { vehicle_id_product_id: { vehicle_id, product_id } },
      include: {
        vehicle: true,
        product: true,
      },
    });
    if (!inv) {
      throw new NotFoundException(`Inventario no encontrado para vehículo ${vehicle_id} y producto ${product_id}`);
    }
    return inv;
  }

  async updateVehicleInventoryQuantities(vehicle_id: number, product_id: number, dto: UpdateVehicleInventoryDto) {
    await this.getVehicleInventoryById(vehicle_id, product_id);
    
    try {
      return await this.vehicle_inventory.update({
        where: { vehicle_id_product_id: { vehicle_id, product_id } },
        data: {
          quantity_loaded: dto.quantity_loaded,
          quantity_empty: dto.quantity_empty,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Error al actualizar las cantidades del inventario del vehículo.');
    }
  }

  async deleteVehicleInventoryById(vehicle_id: number, product_id: number) {
    await this.getVehicleInventoryById(vehicle_id, product_id);
    try {
      await this.vehicle_inventory.delete({
        where: { vehicle_id_product_id: { vehicle_id, product_id } },
      });
      return { message: 'Inventario de vehículo eliminado correctamente.', deleted: true };
    } catch (error) {
      throw new InternalServerErrorException('Error al eliminar el inventario del vehículo.');
    }
  }
}
