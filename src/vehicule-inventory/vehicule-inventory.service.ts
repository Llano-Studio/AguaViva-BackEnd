import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CreateVehiculeInventoryDto } from './dto/create-vehicule-inventory.dto';
import { UpdateVehiculeInventoryDto } from './dto/update-vehicule-inventory.dto';
import { FilterVehiculeInventoryDto } from './dto/filter-vehicle-inventory.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';

@Injectable()
export class VehiculeInventoryService
  extends PrismaClient
  implements OnModuleInit
{
  private readonly entityName = 'Inventario de Vehículo';

  async onModuleInit() {
    await this.$connect();
  }

  private async validateVehicleExists(vehicleId: number) {
    const vehicle = await this.vehicle.findUnique({
      where: { vehicle_id: vehicleId },
    });
    if (!vehicle) {
      throw new BadRequestException(
        `Vehículo con ID ${vehicleId} no encontrado.`,
      );
    }
  }

  private async validateProductExists(productId: number) {
    const product = await this.product.findUnique({
      where: { product_id: productId },
    });
    if (!product) {
      throw new BadRequestException(
        `Producto con ID ${productId} no encontrado.`,
      );
    }
  }

  async createOrUpdateVehicleInventory(dto: CreateVehiculeInventoryDto) {
    await this.validateVehicleExists(dto.vehicle_id);
    await this.validateProductExists(dto.product_id);

    try {
      return await this.vehicle_inventory.upsert({
        where: {
          vehicle_id_product_id: {
            vehicle_id: dto.vehicle_id,
            product_id: dto.product_id,
          },
        },
        update: {
          quantity_loaded: dto.quantity_loaded,
          quantity_empty: dto.quantity_empty,
        },
        create: {
          vehicle_id: dto.vehicle_id,
          product_id: dto.product_id,
          quantity_loaded: dto.quantity_loaded,
          quantity_empty: dto.quantity_empty,
        },
      });
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async getAllVehicleInventory(filters: FilterVehiculeInventoryDto): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE,
      limit = BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
      sortBy,
      vehicle_id,
      product_id,
    } = filters;
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.max(1, limit);

    const where: Prisma.vehicle_inventoryWhereInput = {};
    if (vehicle_id) {
      where.vehicle_id = vehicle_id;
    }
    if (product_id) {
      where.product_id = product_id;
    }

    const defaultSort = [
      { vehicle: { code: 'asc' } },
      { product: { description: 'asc' } },
    ];
    const orderBy = parseSortByString(sortBy, defaultSort);

    try {
      const items = await this.vehicle_inventory.findMany({
        where,
        include: {
          vehicle: true,
          product: true,
        },
        orderBy,
        skip,
        take,
      });
      const totalItems = await this.vehicle_inventory.count({ where });
      return {
        data: items,
        total: totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit),
      };
    } catch (error) {
      handlePrismaError(error, this.entityName + 's');
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async getVehicleInventoryById(vehicle_id: number, product_id: number) {
    const inv = await this.vehicle_inventory.findUnique({
      where: { vehicle_id_product_id: { vehicle_id, product_id } },
      include: {
        vehicle: true,
        product: true,
      },
    });
    if (!inv) {
      throw new NotFoundException(
        `${this.entityName} no encontrado para vehículo ${vehicle_id} y producto ${product_id}`,
      );
    }
    return inv;
  }

  async updateVehicleInventoryQuantities(
    vehicle_id: number,
    product_id: number,
    dto: UpdateVehiculeInventoryDto,
  ) {
    await this.getVehicleInventoryById(vehicle_id, product_id);
    try {
      return await this.vehicle_inventory.update({
        where: { vehicle_id_product_id: { vehicle_id, product_id } },
        data: {
          quantity_loaded: dto.quantity_loaded,
          quantity_empty: dto.quantity_empty,
        },
      });
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async deleteVehicleInventoryById(vehicle_id: number, product_id: number) {
    await this.getVehicleInventoryById(vehicle_id, product_id);
    try {
      await this.vehicle_inventory.delete({
        where: { vehicle_id_product_id: { vehicle_id, product_id } },
      });
      return {
        message: `${this.entityName} eliminado correctamente.`,
        deleted: true,
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }
}
