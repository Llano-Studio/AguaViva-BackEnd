import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CreateProspectCustomerDto } from './dto/create-prospect-customer.dto';
import { UpdateProspectCustomerDto } from './dto/update-prospect-customer.dto';

@Injectable()
export class ProspectCustomersService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async createProspectCustomer(dto: CreateProspectCustomerDto) {

    const localidad = await this.locality.findUnique(
      {
        where: {
          locality_id: dto.localityId
        }

      }
    );

    if (!localidad)
      throw new BadRequestException(`Localidad con id ${dto.localityId} no encontrada`);

    const zona = await this.zone.findUnique(
      {
        where: {
          zone_id: dto.zoneId
        }
      }
    );
    if (!zona)
      throw new BadRequestException(`Zona con id ${dto.zoneId} no encontrada`);



    return this.prospect_customer.create({
      data: {
        name: dto.name,
        tax_id: dto.taxId,
        phone: dto.phone,
        mobile: dto.mobile,
        address: dto.address,
        registration_date: new Date(dto.registrationDate),
        locality_id: dto.localityId,
        zone_id: dto.zoneId,
        notes: dto.notes,
      } as Prisma.prospect_customerUncheckedCreateInput,
    });
  }

  async getAllProspectCustomer() {
    return this.prospect_customer.findMany();
  }

  async getProspectCustomerById(id: number) {
    const prospect = await this.prospect_customer.findUnique({
      where: {
        prospect_customer_id: id
      },
    });
    if (!prospect) {
      throw new NotFoundException(
        `Cliente No registrado con id: ${id} no existe`,
      );
    }
    return prospect;
  }

  async updateProspectCustomerById(id: number, dto: UpdateProspectCustomerDto) {
    await this.getProspectCustomerById(id);

    const localidad = await this.locality.findUnique(
      {
        where: {
          locality_id: dto.localityId
        }

      }
    );

    if (!localidad)
      throw new BadRequestException(`Localidad con id ${dto.localityId} no encontrada`);

    const zona = await this.zone.findUnique(
      {
        where: {
          zone_id: dto.zoneId
        }
      }
    );
    if (!zona)
      throw new BadRequestException(`Zona con id ${dto.zoneId} no encontrada`);

    const data: Prisma.prospect_customerUncheckedUpdateInput = {
      ...dto,
      registration_date: dto.registrationDate
        ? new Date(dto.registrationDate)
        : undefined,
      locality_id: dto.localityId,
      zone_id: dto.zoneId,
    };

    return this.prospect_customer.update({
      where: { prospect_customer_id: id },
      data,
    });
  }

  async deleteProspectCustomerById(id: number) {
    await this.getProspectCustomerById(id);
    return this.prospect_customer.delete({
      where: { prospect_customer_id: id },
    });
  }
}
