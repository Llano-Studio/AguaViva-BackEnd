import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CreateVehicleInventoryDto } from './dto/create-vehicule-inventory.dto';
import { UpdateVehicleInventoryDto } from './dto/update-vehicule-inventory.dto';


@Injectable()
export class VehicleInventoryService extends PrismaClient implements OnModuleInit {

  async onModuleInit() {
    await this.$connect();
  }
  async createVehicleInventory(dto: CreateVehicleInventoryDto) {
    try {
      return await this.vehicle_inventory.create({ data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un inventario para ese vehículo y producto');
      }
      throw new InternalServerErrorException('Error al crear inventario');
    }
  }

  async getAllVehicleInventory() {
    return this.vehicle_inventory.findMany();
  }


  async getVehicleInventoryById(vehicle_id: number, product_id: number) {
    return this.ensureExists(vehicle_id, product_id);
  }

  async updateVehicleInventoryById(vehicle_id: number, product_id: number, dto: UpdateVehicleInventoryDto) {
    await this.ensureExists(vehicle_id, product_id);
    try {
      return await this.vehicle_inventory.update({
        where: { vehicle_id_product_id: { vehicle_id, product_id } },
        data: dto,
      });
    } catch {
      throw new InternalServerErrorException('Error al actualizar inventario');
    }
  }

  async deleteVehiculeInventoryById(vehicle_id: number, product_id: number) {
    await this.ensureExists(vehicle_id, product_id);
    await this.vehicle_inventory.delete({
      where: { vehicle_id_product_id: { vehicle_id, product_id } },
    });
    return { message: 'Inventario eliminado correctamente' };
  }

  private async ensureExists(vehicle_id: number, product_id: number) {
    const inv = await this.vehicle_inventory.findUnique({
      where: { vehicle_id_product_id: { vehicle_id, product_id } },
    });
    if (!inv) throw new NotFoundException(`Inventario no encontrado para vehículo ${vehicle_id} y producto ${product_id}`);
    return inv;
  }

}
