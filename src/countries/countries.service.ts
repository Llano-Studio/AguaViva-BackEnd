import {
  Injectable,
  NotFoundException,
  InternalServerErrorException } from '@nestjs/common';
import { country } from '@prisma/client';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { PrismaBackedService } from '../prisma/prisma-backed.service';
import { PrismaService } from '../prisma/prisma.service';


@Injectable()
export class CountriesService extends PrismaBackedService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  private readonly entityName = 'País';

  async findAll(): Promise<country[]> {
    try {
      return await this.country.findMany({
        include: {
          province: {
            include: {
              locality: true } } },
        orderBy: {
          name: 'asc' } });
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
              locality: true } } } });

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
