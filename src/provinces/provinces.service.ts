import {
  Injectable,
  NotFoundException,
  InternalServerErrorException } from '@nestjs/common';
import { province } from '@prisma/client';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { PrismaBackedService } from '../prisma/prisma-backed.service';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class ProvincesService extends PrismaBackedService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly entityName = 'Provincia';

  async findAll(): Promise<province[]> {
    try {
      return await this.province.findMany({
        include: {
          country: true,
          locality: true },
        orderBy: {
          name: 'asc' } });
    } catch (error) {
      handlePrismaError(error, this.entityName + 's');
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async findById(id: number): Promise<province> {
    try {
      const record = await this.province.findUnique({
        where: { province_id: id },
        include: {
          country: true,
          locality: true } });

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
}
