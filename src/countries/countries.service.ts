import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient, country } from '@prisma/client';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

@Injectable()
export class CountriesService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'País';

  async onModuleInit() {
    await this.$connect();
  }

  async findAll(): Promise<country[]> {
    try {
      return await this.country.findMany({
        include: {
          province: {
            include: {
              locality: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    } catch (error) {
      handlePrismaError(error, this.entityName + 's');
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async findById(id: number): Promise<country> {
    try {
      const record = await this.country.findUnique({
        where: { country_id: id },
        include: {
          province: {
            include: {
              locality: true,
            },
          },
        },
      });

      if (!record) {
        throw new NotFoundException(`${this.entityName} no encontrado.`);
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
}
