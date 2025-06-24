import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { PrismaClient, zone, Prisma } from '@prisma/client';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { FilterZonesDto } from './dto/filter-zones.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

@Injectable()
export class ZonesService  extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Zona';

  async onModuleInit() {
    await this.$connect();
  }

  async getAllZones(filters: FilterZonesDto): Promise<{ data: zone[], meta: { total: number, page: number, limit: number, totalPages: number } }> {
    const { page = 1, limit = 10, sortBy, search, name, locality_id, locality_name } = filters;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);
    
    const where: Prisma.zoneWhereInput = {};
    
    // Búsqueda general en múltiples campos
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { locality: { name: { contains: search, mode: 'insensitive' } } }
      ];
    }
    
    // Filtros específicos
    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      };
    }

    // Filtros de localidad
    if (locality_id) {
      where.locality_id = locality_id;
    }

    if (locality_name) {
      where.locality = {
        name: {
          contains: locality_name,
          mode: 'insensitive',
        },
      };
    }

    const orderByClause = parseSortByString(sortBy, [{ name: 'asc' }]);

    try {
        const zones = await this.zone.findMany({
            where,
            include: {
                locality: {
                    include: {
                        province: {
                            include: {
                                country: true
                            }
                        }
                    }
                },
                person: true
            },
            orderBy: orderByClause,
            skip,
            take
        });
        const totalZones = await this.zone.count({ where });
        return {
            data: zones,
            meta: {
                total: totalZones,
                page,
                limit,
                totalPages: Math.ceil(totalZones / limit)
            }
        };
    } catch (error) {
        handlePrismaError(error, this.entityName + 's');
        throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async getZoneById(id: number): Promise<zone> {
    const record = await this.zone.findUnique({
      where: { zone_id: id },
      include: { 
        locality: {
          include: {
            province: {
              include: {
                country: true
              }
            }
          }
        }, 
        person: true 
      }
    });
    if (!record) throw new NotFoundException(`${this.entityName} no encontrada.`);
    return record;
  }

  async createZone(createZoneDto: CreateZoneDto): Promise<any> {
    const { localityId, ...zoneData } = createZoneDto;

    // Validar que la localidad exista
    const locality = await this.locality.findUnique({
      where: { locality_id: localityId }
    });

    if (!locality) {
      throw new BadRequestException(`La localidad con ID ${localityId} no existe.`);
    }

    try {
      return await this.zone.create({
        data: {
          ...zoneData,
          locality: {
            connect: { locality_id: localityId }
          }
        },
        include: {
          locality: {
            include: {
              province: {
                include: {
                  country: true
                }
              }
            }
          }
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
         throw new ConflictException(`Ya existe una ${this.entityName.toLowerCase()} con el código '${createZoneDto.code}' en esta localidad.`);
      } 
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async updateZoneById(id: number, updateZoneDto: UpdateZoneDto): Promise<any> {
    await this.getZoneById(id);
    const { localityId, ...zoneData } = updateZoneDto as any;

    // Validar que la localidad exista si se proporciona
    if (localityId) {
      const locality = await this.locality.findUnique({
        where: { locality_id: localityId }
      });

      if (!locality) {
        throw new BadRequestException(`La localidad con ID ${localityId} no existe.`);
      }
    }

    const updateData: any = { ...zoneData };
    if (localityId) {
      updateData.locality = {
        connect: { locality_id: localityId }
      };
    }

    try {
      return await this.zone.update({
        where: { zone_id: id },
        data: updateData,
        include: {
          locality: {
            include: {
              province: {
                include: {
                  country: true
                }
              }
            }
          }
        }
      });
    } catch (error) {
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const newCode = (updateZoneDto as any).code;
        const message = newCode 
          ? `El código de ${this.entityName.toLowerCase()} '${newCode}' ya está en uso en esta localidad.`
          : `Conflicto de unicidad al actualizar la ${this.entityName.toLowerCase()} (código duplicado en la localidad).`;
        throw new ConflictException(message);
      } 
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async deleteZoneById(id: number): Promise<void> {
    await this.getZoneById(id);
    try {
      await this.zone.delete({
        where: { zone_id: id },
      });
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }
}
