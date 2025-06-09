import { Injectable, NotFoundException, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import { PrismaClient, locality } from '@prisma/client';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

@Injectable()
export class LocalitiesService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Localidad';

  async onModuleInit() {
    await this.$connect();
  }

  async findAll(): Promise<locality[]> {
    try {
      return await this.locality.findMany({
        include: {
          province: {
            include: {
              country: true
            }
          },
          zone: true
        },
        orderBy: {
          name: 'asc'
        }
      });
    } catch (error) {
      handlePrismaError(error, this.entityName + 'es');
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async findById(id: number): Promise<locality> {
    try {
      const record = await this.locality.findUnique({
        where: { locality_id: id },
        include: {
          province: {
            include: {
              country: true
            }
          },
          zone: true
        }
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
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }
} 