import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, PrismaClient, vehicle as VehiclePrisma } from '@prisma/client';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  FilterVehiclesDto,
  VehicleResponseDto,
  PaginatedVehicleResponseDto,
  AssignZonesToVehicleDto,
  VehicleZoneResponseDto,
} from './dto';
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `El ${this.entityName} con el código '${dto.code}' ya existe.`,
        );
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async getAllVehicles(
    filters?: FilterVehiclesDto,
  ): Promise<PaginatedVehicleResponseDto> {
    const where: Prisma.vehicleWhereInput = {};
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);

    if (filters) {
      // Búsqueda general en múltiples campos
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { code: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Filtros específicos
      if (filters.code) {
        where.code = { contains: filters.code, mode: 'insensitive' };
      }
    }
    const orderBy = parseSortByString(filters?.sortBy, [{ code: 'asc' }]);

    try {
      const vehicles = await this.vehicle.findMany({
        where,
        orderBy,
        skip,
        take,
      });
      const totalVehicles = await this.vehicle.count({ where });

      return {
        data: vehicles.map((v) => this.toVehicleResponseDto(v)),
        total: totalVehicles,
        page,
        limit,
        totalPages: Math.ceil(totalVehicles / limit),
      };
    } catch (error) {
      handlePrismaError(error, this.entityName + 's');
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async getVehicleById(id: number): Promise<VehicleResponseDto> {
    const vehicle = await this.vehicle.findUnique({
      where: { vehicle_id: id },
    });
    if (!vehicle) {
      throw new NotFoundException(
        `${this.entityName} con ID ${id} no encontrado`,
      );
    }
    return this.toVehicleResponseDto(vehicle);
  }

  async getVehicleByCode(code: string): Promise<VehicleResponseDto> {
    const vehicle = await this.vehicle.findUnique({
      where: { code },
    });
    if (!vehicle) {
      throw new NotFoundException(
        `${this.entityName} con código '${code}' no encontrado`,
      );
    }
    return this.toVehicleResponseDto(vehicle);
  }

  async updateVehicleById(
    id: number,
    dto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    const existingVehicle = await this.vehicle.findUnique({
      where: { vehicle_id: id },
    });
    if (!existingVehicle) {
      throw new NotFoundException(
        `${this.entityName} con ID ${id} no encontrado para actualizar.`,
      );
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const newCode = dto.code;
        const message = newCode
          ? `El código de ${this.entityName.toLowerCase()} '${newCode}' ya está en uso por otro ${this.entityName.toLowerCase()}.`
          : `Conflicto de unicidad al actualizar el ${this.entityName.toLowerCase()}.`;
        throw new ConflictException(message);
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async deleteVehicleById(
    id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    await this.getVehicleById(id);
    try {
      await this.vehicle.delete({
        where: { vehicle_id: id },
      });
      return {
        message: `${this.entityName} eliminado correctamente`,
        deleted: true,
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  // Métodos para manejo de zonas

  async assignZonesToVehicle(
    vehicleId: number,
    dto: AssignZonesToVehicleDto,
  ): Promise<VehicleZoneResponseDto[]> {
    // Verificar que el vehículo existe
    await this.getVehicleById(vehicleId);

    // Verificar que todas las zonas existen
    const zones = await this.zone.findMany({
      where: { zone_id: { in: dto.zoneIds } },
    });

    if (zones.length !== dto.zoneIds.length) {
      const foundIds = zones.map((z) => z.zone_id);
      const missingIds = dto.zoneIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Las siguientes zonas no existen: ${missingIds.join(', ')}`,
      );
    }

    try {
      return await this.$transaction(async (prisma) => {
        // Desactivar asignaciones previas si se especifica
        if (dto.isActive !== false) {
          await prisma.vehicle_zone.updateMany({
            where: { vehicle_id: vehicleId },
            data: { is_active: false },
          });
        }

        // Crear nuevas asignaciones
        const assignments = await Promise.all(
          dto.zoneIds.map(async (zoneId) => {
            // Verificar si ya existe la relación
            const existingAssignment = await prisma.vehicle_zone.findFirst({
              where: { vehicle_id: vehicleId, zone_id: zoneId },
            });

            if (existingAssignment) {
              // Actualizar la existente
              return await prisma.vehicle_zone.update({
                where: { vehicle_zone_id: existingAssignment.vehicle_zone_id },
                data: {
                  is_active: dto.isActive ?? true,
                  notes: dto.notes,
                  assigned_at: new Date(),
                },
                include: {
                  zone: {
                    include: {
                      locality: {
                        include: {
                          province: {
                            include: {
                              country: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              });
            } else {
              // Crear nueva
              return await prisma.vehicle_zone.create({
                data: {
                  vehicle_id: vehicleId,
                  zone_id: zoneId,
                  is_active: dto.isActive ?? true,
                  notes: dto.notes,
                },
                include: {
                  zone: {
                    include: {
                      locality: {
                        include: {
                          province: {
                            include: {
                              country: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              });
            }
          }),
        );

        return assignments.map(this.mapToVehicleZoneResponseDto);
      });
    } catch (error) {
      handlePrismaError(error, 'Asignación de zonas');
      throw new InternalServerErrorException(
        'Error no manejado al asignar zonas al vehículo',
      );
    }
  }

  async getVehicleZones(
    vehicleId: number,
    activeOnly: boolean = true,
  ): Promise<VehicleZoneResponseDto[]> {
    await this.getVehicleById(vehicleId);

    try {
      const vehicleZones = await this.vehicle_zone.findMany({
        where: {
          vehicle_id: vehicleId,
          ...(activeOnly && { is_active: true }),
        },
        include: {
          zone: {
            include: {
              locality: {
                include: {
                  province: {
                    include: {
                      country: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { assigned_at: 'desc' },
      });

      return vehicleZones.map(this.mapToVehicleZoneResponseDto);
    } catch (error) {
      handlePrismaError(error, 'Zonas del vehículo');
      throw new InternalServerErrorException(
        'Error no manejado al obtener zonas del vehículo',
      );
    }
  }

  async removeZoneFromVehicle(
    vehicleId: number,
    zoneId: number,
  ): Promise<{ message: string; removed: boolean }> {
    await this.getVehicleById(vehicleId);

    const existingAssignment = await this.vehicle_zone.findFirst({
      where: { vehicle_id: vehicleId, zone_id: zoneId, is_active: true },
    });

    if (!existingAssignment) {
      throw new NotFoundException(
        `No existe una asignación activa entre el vehículo ${vehicleId} y la zona ${zoneId}`,
      );
    }

    try {
      await this.vehicle_zone.update({
        where: { vehicle_zone_id: existingAssignment.vehicle_zone_id },
        data: { is_active: false },
      });

      return {
        message: 'Zona removida del vehículo correctamente',
        removed: true,
      };
    } catch (error) {
      handlePrismaError(error, 'Remoción de zona');
      throw new InternalServerErrorException(
        'Error no manejado al remover zona del vehículo',
      );
    }
  }

  async getZoneVehicles(
    zoneId: number,
    activeOnly: boolean = true,
  ): Promise<VehicleResponseDto[]> {
    // Verificar que la zona existe
    const zone = await this.zone.findUnique({ where: { zone_id: zoneId } });
    if (!zone) {
      throw new NotFoundException(`Zona con ID ${zoneId} no encontrada`);
    }

    try {
      const vehicleZones = await this.vehicle_zone.findMany({
        where: {
          zone_id: zoneId,
          ...(activeOnly && { is_active: true }),
        },
        include: {
          vehicle: true,
        },
        orderBy: { assigned_at: 'desc' },
      });

      return vehicleZones.map((vz) => this.toVehicleResponseDto(vz.vehicle));
    } catch (error) {
      handlePrismaError(error, 'Vehículos de la zona');
      throw new InternalServerErrorException(
        'Error no manejado al obtener vehículos de la zona',
      );
    }
  }

  async getVehicleUsers(vehicleId: number, activeOnly: boolean = true) {
    // Verificar que el vehículo existe
    await this.getVehicleById(vehicleId);

    try {
      const userVehicles = await this.user_vehicle.findMany({
        where: {
          vehicle_id: vehicleId,
          ...(activeOnly && { is_active: true }),
        },
        include: {
          user: true,
        },
        orderBy: { assigned_at: 'desc' },
      });

      return userVehicles.map((uv) => ({
        id: uv.user.id,
        name: uv.user.name,
        email: uv.user.email,
        role: uv.user.role,
        isActive: uv.user.isActive,
        createdAt: uv.user.createdAt.toISOString(),
        updatedAt: uv.user.updatedAt?.toISOString(),
        profileImageUrl: undefined, // No tenemos acceso al buildProfileImageUrl aquí
      }));
    } catch (error) {
      handlePrismaError(error, 'Usuarios del vehículo');
      throw new InternalServerErrorException(
        'Error no manejado al obtener usuarios del vehículo',
      );
    }
  }

  private mapToVehicleZoneResponseDto(
    vehicleZone: any,
  ): VehicleZoneResponseDto {
    return {
      vehicle_zone_id: vehicleZone.vehicle_zone_id,
      vehicle_id: vehicleZone.vehicle_id,
      zone_id: vehicleZone.zone_id,
      assigned_at: vehicleZone.assigned_at.toISOString(),
      is_active: vehicleZone.is_active,
      notes: vehicleZone.notes || undefined,
      zone: {
        zone_id: vehicleZone.zone.zone_id,
        code: vehicleZone.zone.code,
        name: vehicleZone.zone.name,
        locality: {
          locality_id: vehicleZone.zone.locality.locality_id,
          code: vehicleZone.zone.locality.code,
          name: vehicleZone.zone.locality.name,
          province: {
            province_id: vehicleZone.zone.locality.province.province_id,
            code: vehicleZone.zone.locality.province.code,
            name: vehicleZone.zone.locality.province.name,
            country: {
              country_id: vehicleZone.zone.locality.province.country.country_id,
              code: vehicleZone.zone.locality.province.country.code,
              name: vehicleZone.zone.locality.province.country.name,
            },
          },
        },
      },
    };
  }
}
