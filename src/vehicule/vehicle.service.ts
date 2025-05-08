import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CreateVehicleDto } from './dto/create-vehicule.dto';
import { UpdateVehicleDto } from './dto/update-vehicule.dto';

@Injectable()
export class VehicleService extends PrismaClient implements OnModuleInit {

  async onModuleInit() {
    await this.$connect();
  }

  async createVehicle(dto: CreateVehicleDto) {
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
        throw new ConflictException(`El vehículo con el código '${dto.code}' ya existe.`);
      }
      // Considerar loguear el error original aquí para depuración
      throw new InternalServerErrorException('Error al crear el vehículo');
    }
  }

  async getAllVehicles() {
    return this.vehicle.findMany();
  }

  async getVehicleById(id: number) {
    const vehicle = await this.vehicle.findUnique({
        where: { vehicle_id: id }
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehículo con ID ${id} no encontrado`);
    }
    return vehicle;
  }

  async getVehicleByCode(code: string) {
    const vehicle = await this.vehicle.findUnique({
        where: { code }
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehículo con código '${code}' no encontrado`);
    }
    return vehicle;
  }

  async updateVehicleById(id: number, dto: UpdateVehicleDto) {
    await this.getVehicleById(id); // Verifica que el vehículo exista
    try {
      return await this.vehicle.update({
        where: { vehicle_id: id },
        data: dto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // Asumiendo que 'code' es el campo único que causa este error en la actualización
        // y que el DTO de actualización también contiene `code` si se intenta cambiar.
        const newCode = (dto as any).code; // Acceso seguro si code es opcional en UpdateVehicleDto
        const message = newCode 
          ? `El código de vehículo '${newCode}' ya está en uso por otro vehículo.`
          : 'Conflicto de unicidad al actualizar el vehículo.';
        throw new ConflictException(message);
      }
      // Considerar loguear el error original aquí
      throw new InternalServerErrorException('Error al actualizar el vehículo');
    }
  }

  async deleteVehicleById(id: number) {
    await this.getVehicleById(id); // Verifica que el vehículo exista
    try {
      await this.vehicle.delete({
          where: { vehicle_id: id }
      });
      return {
        message: 'Vehículo eliminado correctamente',
        deleted: true,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar el vehículo porque está siendo referenciado en otras partes del sistema (ej. hojas de ruta, inventario de vehículo).');
      }
      // Considerar loguear el error original aquí
      throw new InternalServerErrorException('Error al eliminar el vehículo');
    }
  }
}
