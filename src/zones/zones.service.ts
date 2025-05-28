import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
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

  async createZone(createZoneDto: CreateZoneDto): Promise<zone> {
    try {
      return await this.zone.create({
        data: createZoneDto,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
         throw new ConflictException(`La ${this.entityName} con el código '${createZoneDto.code}' ya existe.`);
      } 
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async getAllZones(filters: FilterZonesDto): Promise<{ data: zone[], total: number, page: number, limit: number, totalPages: number }> {
    const { page = 1, limit = 10, sortBy, name } = filters;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);
    
    const where: Prisma.zoneWhereInput = {};
    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      };
    }

    const orderByClause = parseSortByString(sortBy, [{ name: 'asc' }]);

    try {
        const zones = await this.zone.findMany({
            where,
            include: {
                locality: true,
                person: true
            },
            orderBy: orderByClause,
            skip,
            take
        });
        const totalZones = await this.zone.count({ where });
        return {
            data: zones,
            total: totalZones,
            page,
            limit,
            totalPages: Math.ceil(totalZones / limit)
        };
    } catch (error) {
        handlePrismaError(error, this.entityName + 's');
        throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async getZoneById(id: number): Promise<zone> {
    const record = await this.zone.findUnique({
      where: { zone_id: id },
      include: { locality: true, person: true }
    });
    if (!record) throw new NotFoundException(`${this.entityName} no encontrada.`);
    return record;
  }

  async updateZoneById(id: number, updateZoneDto: UpdateZoneDto): Promise<zone> {
    await this.getZoneById(id);
    try {
      return await this.zone.update({
        where: { zone_id: id },
        data: updateZoneDto,
      });
    } catch (error) {
       if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const newCode = (updateZoneDto as any).code;
        const message = newCode 
          ? `El código de ${this.entityName.toLowerCase()} '${newCode}' ya está en uso por otra ${this.entityName.toLowerCase()}.`
          : `Conflicto de unicidad al actualizar la ${this.entityName.toLowerCase()} (ej. código duplicado).`;
        throw new ConflictException(message);
      } 
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async deleteZoneById(id: number): Promise<{ message: string, deleted: boolean }> {
    await this.getZoneById(id);
    try {
      await this.zone.delete({ where: { zone_id: id } });
      return { message: `${this.entityName} eliminada correctamente.`, deleted: true };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }
}
