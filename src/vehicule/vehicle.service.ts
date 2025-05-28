import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient, vehicle as VehiclePrisma } from '@prisma/client';
import { CreateVehicleDto, UpdateVehicleDto, FilterVehiclesDto, VehicleResponseDto, PaginatedVehicleResponseDto } from './dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

@Injectable()
export class VehicleService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Vehículo';

  async onModuleInit() {
    await this.$connect();
  }

  private toVehicleResponseDto(vehicle: VehiclePrisma): VehicleResponseDto {
    return {
      vehicle_id: vehicle.vehicle_id,
      code: vehicle.code,
      name: vehicle.name,
      description: vehicle.description || undefined,
    };
  }

  async createVehicle(dto: CreateVehicleDto): Promise<VehicleResponseDto> {
    try {
      const newVehicle = await this.vehicle.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description,
        },
      });
      return this.toVehicleResponseDto(newVehicle);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
         throw new ConflictException(`El ${this.entityName} con el código '${dto.code}' ya existe.`);
      } 
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async getAllVehicles(filters?: FilterVehiclesDto): Promise<PaginatedVehicleResponseDto> {
    const where: Prisma.vehicleWhereInput = {};
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);

    if (filters) {
      if (filters.code) {
        where.code = { contains: filters.code, mode: 'insensitive' };
      }
    }
    const orderBy = parseSortByString(filters?.sortBy, [{ code: 'asc' }]);
    
    try {
        const vehicles = await this.vehicle.findMany({ where, orderBy, skip, take });
        const totalVehicles = await this.vehicle.count({ where });

        return {
            data: vehicles.map(v => this.toVehicleResponseDto(v)),
            total: totalVehicles,
            page,
            limit,
            totalPages: Math.ceil(totalVehicles / limit)
        };
    } catch (error) {
        handlePrismaError(error, this.entityName + 's');
        throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async getVehicleById(id: number): Promise<VehicleResponseDto> {
    const vehicle = await this.vehicle.findUnique({
        where: { vehicle_id: id }
    });
    if (!vehicle) {
      throw new NotFoundException(`${this.entityName} con ID ${id} no encontrado`);
    }
    return this.toVehicleResponseDto(vehicle);
  }

  async getVehicleByCode(code: string): Promise<VehicleResponseDto> {
    const vehicle = await this.vehicle.findUnique({
        where: { code }
    });
    if (!vehicle) {
      throw new NotFoundException(`${this.entityName} con código '${code}' no encontrado`);
    }
    return this.toVehicleResponseDto(vehicle);
  }

  async updateVehicleById(id: number, dto: UpdateVehicleDto): Promise<VehicleResponseDto> {
    const existingVehicle = await this.vehicle.findUnique({ where: { vehicle_id: id } });
    if (!existingVehicle) {
        throw new NotFoundException(`${this.entityName} con ID ${id} no encontrado para actualizar.`);
    }
    try {
      const updatedVehicle = await this.vehicle.update({
        where: { vehicle_id: id },
        data: {
            code: dto.code,
            name: dto.name,
            description: dto.description,
        },
      });
      return this.toVehicleResponseDto(updatedVehicle);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const newCode = dto.code;
        const message = newCode 
          ? `El código de ${this.entityName.toLowerCase()} '${newCode}' ya está en uso por otro ${this.entityName.toLowerCase()}.`
          : `Conflicto de unicidad al actualizar el ${this.entityName.toLowerCase()}.`;
        throw new ConflictException(message);
      } 
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async deleteVehicleById(id: number): Promise<{ message: string, deleted: boolean }> {
    await this.getVehicleById(id); 
    try {
      await this.vehicle.delete({
          where: { vehicle_id: id }
      });
      return {
        message: `${this.entityName} eliminado correctamente`, 
        deleted: true,
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }
}
