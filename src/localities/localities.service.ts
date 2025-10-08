import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  OnModuleInit,
  ConflictException,
} from '@nestjs/common';
import { PrismaClient, locality } from '@prisma/client';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { CreateLocalityDto, UpdateLocalityDto } from './dto';

@Injectable()
export class LocalitiesService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Localidad';

  async onModuleInit() {
    await this.$connect();
  }

  async findAll(): Promise<locality[]> {
    try {
      return await this.locality.findMany({
        where: {
          is_active: true, // Solo mostrar localidades activas
        },
        include: {
          province: {
            include: {
              country: true,
            },
          },
          zones: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      handlePrismaError(error, this.entityName + 'es');
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async findById(
    id: number,
    includeInactive: boolean = false,
  ): Promise<locality> {
    try {
      const record = await this.locality.findFirst({
        where: {
          locality_id: id,
          ...(includeInactive ? {} : { is_active: true }),
        },
        include: {
          province: {
            include: {
              country: true,
            },
          },
          zones: true,
        },
      });

      if (!record) {
        throw new NotFoundException(`${this.entityName} no encontrada.`);
      }

      return record;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async create(dto: CreateLocalityDto): Promise<locality> {
    try {
      // Verificar que la provincia existe
      const province = await this.province.findUnique({
        where: { province_id: dto.provinceId },
      });

      if (!province) {
        throw new NotFoundException('Provincia no encontrada.');
      }

      // Verificar que no existe otra localidad con el mismo código
      const existingLocality = await this.locality.findFirst({
        where: { code: dto.code },
      });

      if (existingLocality) {
        throw new ConflictException(
          `Ya existe una localidad con el código '${dto.code}'. Por favor, utilice un código diferente.`,
        );
      }

      const newLocality = await this.locality.create({
        data: {
          code: dto.code,
          name: dto.name,
          province_id: dto.provinceId,
        },
        include: {
          province: {
            include: {
              country: true,
            },
          },
          zones: true,
        },
      });

      return newLocality;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async update(id: number, dto: UpdateLocalityDto): Promise<locality> {
    try {
      // Verificar que la localidad existe
      const existingLocality = await this.locality.findUnique({
        where: { locality_id: id },
      });

      if (!existingLocality) {
        throw new NotFoundException(`${this.entityName} no encontrada.`);
      }

      // Si se está actualizando la provincia, verificar que existe
      if (dto.provinceId) {
        const province = await this.province.findUnique({
          where: { province_id: dto.provinceId },
        });

        if (!province) {
          throw new NotFoundException('Provincia no encontrada.');
        }
      }

      // Si se está actualizando el código, verificar que no existe otro con el mismo código
      if (dto.code && dto.code !== existingLocality.code) {
        const duplicateLocality = await this.locality.findFirst({
          where: {
            code: dto.code,
            locality_id: { not: id },
          },
        });

        if (duplicateLocality) {
          throw new ConflictException(
            'Ya existe una localidad con este código.',
          );
        }
      }

      const updatedLocality = await this.locality.update({
        where: { locality_id: id },
        data: {
          ...(dto.code && { code: dto.code }),
          ...(dto.name && { name: dto.name }),
          ...(dto.provinceId && { province_id: dto.provinceId }),
        },
        include: {
          province: {
            include: {
              country: true,
            },
          },
          zones: true,
        },
      });

      return updatedLocality;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async delete(id: number): Promise<{ message: string; deleted: boolean }> {
    try {
      // Verificar que la localidad existe
      const existingLocality = await this.locality.findUnique({
        where: { locality_id: id },
      });

      if (!existingLocality) {
        throw new NotFoundException(`${this.entityName} no encontrada.`);
      }

      // Soft delete: cambiar is_active a false en lugar de eliminar físicamente
      await this.locality.update({
        where: { locality_id: id },
        data: { is_active: false },
      });

      return {
        message: `${this.entityName} desactivada correctamente`,
        deleted: true,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }
}
