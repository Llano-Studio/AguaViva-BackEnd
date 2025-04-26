import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class CustomersService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async createCustomber(dto: CreateCustomerDto) {

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


    if (dto.subscriptionPlanId !== undefined) {
      const plan = await this.subscription_plan.findUnique(
        {
          where: {
            subscription_plan_id: dto.subscriptionPlanId
          },
        });
      if (!plan)
        throw new BadRequestException(`El plan de subscripcion con id ${dto.subscriptionPlanId} no existe`);
    }

    const data: Prisma.customerCreateInput = {
      name: dto.name,
      tax_id: dto.taxId,
      vat_category: dto.vatCategory,
      address: dto.address,
      registration_date: new Date(dto.registrationDate),
      locality: { connect: { locality_id: dto.localityId } },
      zone: { connect: { zone_id: dto.zoneId } },
      status: dto.status,
      phone: dto.phone,
      mobile: dto.mobile,
      notes: dto.notes,
      debt: new Prisma.Decimal(dto.debt ?? 0),
      subscription_plan: dto.subscriptionPlanId
        ? { connect: { subscription_plan_id: dto.subscriptionPlanId } }
        : undefined,
    };

    return this.customer.create({ data });
  }

  async findAllCustomers() {
    return this.customer.findMany();
  }

  async getCustomerById(id: number) {
    const customer = await this.customer.findUnique({
      where: { customer_id: id },
    });

    if (!customer)
      throw new NotFoundException(`Cliente con id: ${id} no encontrado`);

    return customer
  }

  async updateCustomerById(id: number, dto: UpdateCustomerDto) {

    await this.getCustomerById(id);

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


    if (dto.subscriptionPlanId !== undefined) {
      const plan = await this.subscription_plan.findUnique(
        {
          where: {
            subscription_plan_id: dto.subscriptionPlanId
          },
        });
      if (!plan)
        throw new BadRequestException(`El plan de subscripcion con id ${dto.subscriptionPlanId} no existe`);
    }

    const data: Prisma.customerUncheckedUpdateInput = {
      ...dto,
      registration_date: dto.registrationDate ? new Date(dto.registrationDate) : undefined,
      locality_id: dto.localityId,
      zone_id: dto.zoneId,
      subscription_plan_id: dto.subscriptionPlanId,
    }

    return this.customer.update(
      {
        where: {
          customer_id: id
        },
        data,
      });
  }

  async deleteCustomer(id: number) {
    await this.getCustomerById(id);

    return this.customer.delete(
      {
        where: {
          customer_id: id
        }
      }
    )
  }
}
