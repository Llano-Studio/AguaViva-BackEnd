import { Injectable, NotFoundException, ConflictException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaClient, zone } from '@prisma/client';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';

@Injectable()
export class ZonesService  extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
  async createZone(createZoneDto: CreateZoneDto): Promise<zone> {
    try {
      return await this.zone.create({
        data: createZoneDto,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`La zona con el código '${createZoneDto.code}' ya existe.`);
      }
      throw new InternalServerErrorException('Error al crear la zona.');
    }
  }

  async getAllZones(): Promise<zone[]> {
    return this.zone.findMany({
      include: {
        locality: true,
        person: true
      }
    });
  }

  async getZoneById(id: number): Promise<zone> {
    const zone = await this.zone.findUnique({
      where: { zone_id: id },
      include: { locality: true, person: true }
    });
    if (!zone) throw new NotFoundException('Zona no encontrada');
    return zone;
  }

  async updateZoneById(id: number, updateZoneDto: UpdateZoneDto): Promise<zone> {
    await this.getZoneById(id);
    try {
      const updated = await this.zone.update({
        where: { zone_id: id },
        data: updateZoneDto,
      });
      return updated;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Zona no encontrada');
      }
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        const newCode = (updateZoneDto as any).code;
        const message = newCode 
          ? `El código de zona '${newCode}' ya está en uso por otra zona.`
          : 'Conflicto de unicidad al actualizar la zona (ej. código duplicado).';
        throw new ConflictException(message);
      }
      throw new InternalServerErrorException('Error al actualizar la zona.');
    }
  }

  async deleteZoneById(id: number): Promise<{ message: string, deleted: boolean }> {
    await this.getZoneById(id);
    try {
      await this.zone.delete({ where: { zone_id: id } });
      return { message: 'Zona eliminada correctamente.', deleted: true };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Zona no encontrada');
      }
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException('No se puede eliminar la zona porque está siendo referenciada (ej. por localidades o personas). Elimine o reasigne estas referencias primero.');
      }
      throw new InternalServerErrorException('Error al eliminar la zona.');
    }
  }
}
