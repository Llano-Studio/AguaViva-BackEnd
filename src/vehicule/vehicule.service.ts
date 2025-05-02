import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CreateVehicleDto } from './dto/create-vehicule.dto';
import { UpdateVehicleDto } from './dto/update-vehicule.dto';

@Injectable()
export class VehicleService extends PrismaClient implements OnModuleInit {

  async onModuleInit() {
    await this.$connect();
  }

  async createVehicule(dto: CreateVehicleDto) {
    try {
      return await this.vehicle.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El código de vehículo ya existe');
      }
      throw new InternalServerErrorException('Error al crear el vehículo');
    }
  }

  getAllVehicules() {
    return this.vehicle.findMany();
  }

  async getVehiculeById(id: number) {
    const vehicle = await this.vehicle.findUnique(
      {
        where: { vehicle_id: id }
      }
    );
    if (!vehicle) throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
    return vehicle;
  }

  async getVehiculeByCode(code: string) {
    const vehicle = await this.vehicle.findUnique(
      {
        where: { code }
      }
    );
    if (!vehicle) throw new NotFoundException(`Vehículo con código ${code} no encontrado`);
    return vehicle;
  }

  async updateVehiculeById(id: number, dto: UpdateVehicleDto) {
    try {
      await this.getVehiculeById(id);
      return await this.vehicle.update({
        where: {
          vehicle_id: id
        },
        data: dto,
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El código de vehículo ya existe');
      }
      throw new InternalServerErrorException('Error al actualizar el vehículo');
    }
  }

  async deleteVehiculeById(id: number) {
    await this.getVehiculeById(id);
    await this.vehicle.delete(
      {
        where: {
          vehicle_id: id
        }
      });
    return {
      message: 'Vehículo eliminado correctamente'
    };
  }
}
