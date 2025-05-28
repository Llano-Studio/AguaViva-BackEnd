import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient, Prisma, SubscriptionStatus, OrderStatus as PrismaOrderStatus, ContractStatus, person, locality, zone, province, PersonType as PrismaPersonType } from '@prisma/client';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { LoanedProductDto, PersonResponseDto } from './dto/person-response.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { ChangeContractPriceListDto } from './dto/change-contract-price-list.dto';
import { FilterPersonsDto } from './dto/filter-persons.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { BUSINESS_CONFIG, PaymentSemaphoreStatus } from '../common/config/business.config';
import { PaymentSemaphoreService } from '../common/services/payment-semaphore.service';

@Injectable()
export class PersonsService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Persona';

  constructor(private readonly paymentSemaphoreService: PaymentSemaphoreService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  private async getPaymentSemaphoreStatus(personId: number): Promise<PaymentSemaphoreStatus> {
    return this.paymentSemaphoreService.getPaymentSemaphoreStatus(personId);
  }

  private async getLoanedProducts(personId: number): Promise<LoanedProductDto[]> {
    const orders = await this.order_header.findMany({
      where: {
        customer_id: personId,
        status: { notIn: [PrismaOrderStatus.CANCELLED] }
      },
      include: {
        order_item: {
          where: {
            product: {
              is_returnable: true
            }
          },
          include: { product: true },
        },
      },
    });
    const productMap = new Map<number, { description: string; loaned_quantity: number }>();

    for (const order of orders) {
      for (const item of order.order_item) {
        const delivered = item.delivered_quantity ?? 0;
        const returned = item.returned_quantity ?? 0;
        const netLoanedForItem = delivered - returned;
        if (netLoanedForItem > 0) {
          const productId = item.product_id;
          const current = productMap.get(productId) || { description: item.product.description, loaned_quantity: 0 };
          current.loaned_quantity += netLoanedForItem;
          productMap.set(productId, current);
        }
      }
    }
    const loanedProducts: LoanedProductDto[] = [];
    for (const [product_id, data] of productMap.entries()) {
      if (data.loaned_quantity > 0) {
        loanedProducts.push({ product_id, description: data.description, loaned_quantity: data.loaned_quantity });
      }
    }
    return loanedProducts;
  }

  private mapToPersonResponseDto(
    personEntity: person & {
      locality?: (locality & { province?: province }) | null;
      zone?: zone | null;
    },
    loanedProducts: LoanedProductDto[],
    paymentSemaphoreStatus: PaymentSemaphoreStatus
  ): PersonResponseDto {
    return {
      person_id: personEntity.person_id,
      name: personEntity.name || '',
      phone: personEntity.phone,
      address: personEntity.address || '',
      localityId: personEntity.locality_id === null ? 0 : personEntity.locality_id,
      zoneId: personEntity.zone_id === null ? 0 : personEntity.zone_id,
      taxId: personEntity.tax_id || '',
      type: personEntity.type as any,
      registrationDate: personEntity.registration_date.toISOString(),
      registration_date: personEntity.registration_date,
      locality: personEntity.locality as any,
      zone: personEntity.zone as any,
      loaned_products: loanedProducts,
      payment_semaphore_status: paymentSemaphoreStatus,
    };
  }

  async createPerson(dto: CreatePersonDto): Promise<PersonResponseDto> {
    if (dto.localityId) {
      const localityExists = await this.locality.findUnique({ where: { locality_id: dto.localityId } });
      if (!localityExists) throw new BadRequestException(`Localidad con ID ${dto.localityId} no encontrada.`);
    }

    if (dto.zoneId) {
      const zoneExists = await this.zone.findUnique({ where: { zone_id: dto.zoneId } });
      if (!zoneExists) throw new BadRequestException(`Zona con ID ${dto.zoneId} no encontrada.`);
    }

    let registration_date_for_prisma: Date | undefined = undefined;
    if (dto.registrationDate) {
      const parsedDate = new Date(dto.registrationDate);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException('registrationDate inválido: formato incorrecto.');
      }
      registration_date_for_prisma = parsedDate;
    }

    const data: Prisma.personCreateInput = {
      name: dto.name,
      phone: dto.phone,
      address: dto.address,
      tax_id: dto.taxId,
      registration_date: registration_date_for_prisma,
      type: dto.type as PrismaPersonType,
    };
    if (dto.localityId) data.locality = { connect: { locality_id: dto.localityId } };
    if (dto.zoneId) data.zone = { connect: { zone_id: dto.zoneId } };

    try {
      const newPerson = await this.person.create({
        data,
        include: {
          locality: { include: { province: true } },
          zone: true
        }
      });
      const semaphoreStatus = await this.getPaymentSemaphoreStatus(newPerson.person_id);
      const loanedProducts = await this.getLoanedProducts(newPerson.person_id);

      return this.mapToPersonResponseDto(newPerson, loanedProducts, semaphoreStatus);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`El teléfono '${dto.phone}' ya está registrado para otra ${this.entityName.toLowerCase()}.`);
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async findAllPersons(filters: FilterPersonsDto): Promise<{ data: PersonResponseDto[], total: number, page: number, limit: number, totalPages: number }> {
    const {
      page = 1,
      limit = 10,
      name,
      address,
      type,
      personId,
      phone,
      taxId,
      localityId,
      zoneId,
      payment_semaphore_status,
      sortBy
    } = filters;

    const where: Prisma.personWhereInput = {};

    if (personId) where.person_id = personId;
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (address) where.address = { contains: address, mode: 'insensitive' };
    if (type) where.type = type as PrismaPersonType;
    if (phone) where.phone = { contains: phone, mode: 'insensitive' };
    if (taxId) where.tax_id = { contains: taxId, mode: 'insensitive' };
    if (localityId) where.locality_id = localityId;
    if (zoneId) where.zone_id = zoneId;

    const orderByClause = parseSortByString(sortBy, [{ name: 'asc' }]);

    try {
      // Si se filtra por semáforo, necesitamos obtener todas las personas para calcular el semáforo
      if (payment_semaphore_status) {
        const allPersonsFromDb = await this.person.findMany({
          where,
          include: {
            locality: { include: { province: true } },
            zone: true
          },
          orderBy: orderByClause 
        });

        // Pre-calcular semáforos en lotes para mejor rendimiento
        const personIds = allPersonsFromDb.map(p => p.person_id);
        const semaphoreMap = await this.paymentSemaphoreService.preCalculateForPersons(personIds);

        // Filtrar por estado de semáforo y procesar
        let processedAndFilteredPersons: PersonResponseDto[] = [];
        for (const person of allPersonsFromDb) {
          const semaphoreStatus = semaphoreMap.get(person.person_id) || 'NONE';
          if (semaphoreStatus === payment_semaphore_status) {
            const loanedProducts = await this.getLoanedProducts(person.person_id);
            processedAndFilteredPersons.push(
              this.mapToPersonResponseDto(person, loanedProducts, semaphoreStatus)
            );
          }
        }

        const totalFiltered = processedAndFilteredPersons.length;
        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);
        const paginatedData = processedAndFilteredPersons.slice(skip, skip + take);

        return { 
          data: paginatedData, 
          total: totalFiltered, 
          page, 
          limit: take, 
          totalPages: Math.ceil(totalFiltered / take) 
        };
      } else {
        // Sin filtro de semáforo, podemos aplicar paginación directamente en la BD
        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);

        const [totalCount, personsFromDb] = await Promise.all([
          this.person.count({ where }),
          this.person.findMany({
            where,
            include: {
              locality: { include: { province: true } },
              zone: true
            },
            orderBy: orderByClause,
            skip,
            take
          })
        ]);

        // Pre-calcular semáforos en lotes para mejor rendimiento
        const personIds = personsFromDb.map(p => p.person_id);
        const semaphoreMap = await this.paymentSemaphoreService.preCalculateForPersons(personIds);

        // Procesar personas con semáforos pre-calculados
        const processedPersons: PersonResponseDto[] = [];
        for (const person of personsFromDb) {
          const semaphoreStatus = semaphoreMap.get(person.person_id) || 'NONE';
          const loanedProducts = await this.getLoanedProducts(person.person_id);
          processedPersons.push(
            this.mapToPersonResponseDto(person, loanedProducts, semaphoreStatus)
          );
        }

        return { 
          data: processedPersons, 
          total: totalCount, 
          page, 
          limit: take, 
          totalPages: Math.ceil(totalCount / take) 
        };
      }
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(`Error obteniendo listado de ${this.entityName.toLowerCase()}s.`);
    }
  }

  async findPersonById(id: number): Promise<PersonResponseDto> {
    const person = await this.person.findUnique({
      where: { person_id: id },
      include: {
        locality: { include: { province: true } },
        zone: true
      }
    });
    if (!person) throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada.`);

    const semaphoreStatus = await this.getPaymentSemaphoreStatus(id);
    const loanedProducts = await this.getLoanedProducts(id);

    return this.mapToPersonResponseDto(person, loanedProducts, semaphoreStatus);
  }

  async updatePerson(id: number, dto: UpdatePersonDto): Promise<PersonResponseDto> {
    const existingPerson = await this.person.findUnique({ where: { person_id: id } });
    if (!existingPerson) throw new NotFoundException(`${this.entityName} con ID ${id} no encontrada.`);

    if (dto.localityId) {
      const localityExists = await this.locality.findUnique({ where: { locality_id: dto.localityId } });
      if (!localityExists) throw new BadRequestException(`Localidad con ID ${dto.localityId} no encontrada.`);
    }
    if (dto.zoneId) {
      const zoneExists = await this.zone.findUnique({ where: { zone_id: dto.zoneId } });
      if (!zoneExists) throw new BadRequestException(`Zona con ID ${dto.zoneId} no encontrada.`);
    }

    let registration_date_obj: Date | undefined = undefined;
    if (dto.registrationDate) {
      registration_date_obj = new Date(dto.registrationDate);
      if (isNaN(registration_date_obj.getTime())) {
        throw new BadRequestException('Formato de registrationDate inválido.');
      }
    }

    const dataToUpdate: Prisma.personUpdateInput = {};

    if (dto.name !== undefined) dataToUpdate.name = dto.name;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone;
    if (dto.address !== undefined) dataToUpdate.address = dto.address;
    if (dto.taxId !== undefined) dataToUpdate.tax_id = dto.taxId;
    if (dto.type !== undefined) dataToUpdate.type = dto.type as PrismaPersonType; 
    dataToUpdate.registration_date = registration_date_obj ?? existingPerson.registration_date;

    if (dto.localityId !== undefined) {
      dataToUpdate.locality = { connect: { locality_id: dto.localityId } };
    } else if (dto.hasOwnProperty('localityId') && dto.localityId === null) { 
      dataToUpdate.locality = { disconnect: true };
    }

    if (dto.zoneId !== undefined) {
      dataToUpdate.zone = { connect: { zone_id: dto.zoneId } };
    } else if (dto.hasOwnProperty('zoneId') && dto.zoneId === null) { 
      dataToUpdate.zone = { disconnect: true };
    }

    try {
      const updatedPerson = await this.person.update({
        where: { person_id: id },
        data: dataToUpdate,
        include: { locality: { include: { province: true } }, zone: true }
      });
      const semaphoreStatus = await this.getPaymentSemaphoreStatus(updatedPerson.person_id);
      const loanedProducts = await this.getLoanedProducts(updatedPerson.person_id);
      return this.mapToPersonResponseDto(updatedPerson, loanedProducts, semaphoreStatus);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`El teléfono '${dto.phone ?? existingPerson.phone}' ya está registrado para otra ${this.entityName.toLowerCase()}.`);
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async deletePerson(id: number): Promise<{ message: string; deleted: boolean }> {
    await this.findPersonById(id);
    try {
      await this.person.delete({ where: { person_id: id } });
      return { message: `${this.entityName} con ID ${id} eliminada correctamente.`, deleted: true };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error no manejado después de handlePrismaError');
    }
  }

  async cancelSubscription(personId: number, subscriptionId: number): Promise<Prisma.customer_subscriptionGetPayload<{}>> {
    return this.$transaction(async (tx) => {
      const subscription = await tx.customer_subscription.findUnique({
        where: { subscription_id: subscriptionId },
        include: {
          subscription_cycle: {
            orderBy: { cycle_end: 'desc' },
            take: 1, 
          },
        },
      });

      if (!subscription) {
        throw new NotFoundException(`Suscripción con ID ${subscriptionId} no encontrada.`);
      }
      if (subscription.customer_id !== personId) {
        throw new ForbiddenException(`No tienes permiso para cancelar la suscripción ID ${subscriptionId} de otra persona.`);
      }
      if (subscription.status === SubscriptionStatus.CANCELLED || subscription.status === SubscriptionStatus.EXPIRED) {
        throw new BadRequestException('La suscripción ya está cancelada o expirada.');
      }
      if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.PAUSED) {
        throw new BadRequestException(`La suscripción está en estado ${subscription.status} y no se puede cancelar desde este estado.`);
      }

      let effectiveEndDate = subscription.subscription_cycle?.[0]?.cycle_end || new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (effectiveEndDate < today) effectiveEndDate = today;

      const updatedSubscription = await tx.customer_subscription.update({
        where: { subscription_id: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          end_date: effectiveEndDate,
        },
      });

      await tx.order_header.updateMany({
        where: {
          subscription_id: subscriptionId,
          scheduled_delivery_date: { gt: effectiveEndDate }, 
          status: {
            in: [PrismaOrderStatus.PENDING, PrismaOrderStatus.PROCESSING],
          },
        },
        data: {
          status: PrismaOrderStatus.CANCELLED,
        },
      });
      return updatedSubscription;
    });
  }

  async changeSubscriptionPlan(personId: number, dto: ChangeSubscriptionPlanDto): Promise<Prisma.customer_subscriptionGetPayload<{}>> {
    return this.$transaction(async (tx) => {
      const currentSubscription = await tx.customer_subscription.findUnique({
        where: { subscription_id: dto.current_subscription_id },
        include: {
          subscription_cycle: { orderBy: { cycle_end: 'desc' }, take: 1 },
        },
      });

      if (!currentSubscription) {
        throw new NotFoundException(`Suscripción actual con ID ${dto.current_subscription_id} no encontrada.`);
      }
      if (currentSubscription.customer_id !== personId) {
        throw new ForbiddenException('No tienes permiso para modificar esta suscripción.');
      }
      if (currentSubscription.status !== SubscriptionStatus.ACTIVE && currentSubscription.status !== SubscriptionStatus.PAUSED) {
        throw new BadRequestException(
          `La suscripción actual está en estado ${currentSubscription.status} y no se puede cambiar. Solo se pueden cambiar suscripciones ACTIVAS o PAUSADAS.`,
        );
      }

      const newPlan = await tx.subscription_plan.findUnique({
        where: { subscription_plan_id: dto.new_plan_id },
      });
      if (!newPlan) {
        throw new NotFoundException(`Nuevo plan de suscripción con ID ${dto.new_plan_id} no encontrado.`);
      }
      if (currentSubscription.subscription_plan_id === dto.new_plan_id) {
        throw new BadRequestException('La suscripción actual ya tiene el plan seleccionado.');
      }

      let oldSubscriptionEndDate = currentSubscription.subscription_cycle?.[0]?.cycle_end || new Date();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (oldSubscriptionEndDate < today) oldSubscriptionEndDate = today;

      const newSubscriptionStartDate = new Date(oldSubscriptionEndDate);
      newSubscriptionStartDate.setDate(oldSubscriptionEndDate.getDate() + 1);
      newSubscriptionStartDate.setHours(0, 0, 0, 0);

      await tx.customer_subscription.update({
        where: { subscription_id: dto.current_subscription_id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          end_date: oldSubscriptionEndDate,
          notes: `${currentSubscription.notes || ''} - Reemplazada por plan ${dto.new_plan_id} el ${new Date().toISOString()}`.trim(),
        },
      });

      await tx.order_header.updateMany({
        where: {
          subscription_id: dto.current_subscription_id,
          scheduled_delivery_date: { gt: oldSubscriptionEndDate },
          status: { in: [PrismaOrderStatus.PENDING, PrismaOrderStatus.PROCESSING] },
        },
        data: { status: PrismaOrderStatus.CANCELLED },
      });

      const newSubscription = await tx.customer_subscription.create({
        data: {
          customer_id: personId,
          subscription_plan_id: dto.new_plan_id,
          start_date: newSubscriptionStartDate,
          status: SubscriptionStatus.ACTIVE,
          notes: `Iniciada por cambio desde suscripción ID ${dto.current_subscription_id}`,
        },
      });

      const firstCycleStartDate = new Date(newSubscriptionStartDate);
      const firstCycleEndDate = new Date(firstCycleStartDate);
      firstCycleEndDate.setMonth(firstCycleStartDate.getMonth() + 1); 
      firstCycleEndDate.setDate(firstCycleStartDate.getDate() -1);
      firstCycleEndDate.setHours(23, 59, 59, 999);

      await tx.subscription_cycle.create({
        data: {
          subscription_id: newSubscription.subscription_id,
          cycle_start: firstCycleStartDate,
          cycle_end: firstCycleEndDate,
          notes: 'Primer ciclo post cambio de plan.',
        },
      });
      return newSubscription;
    });
  }

  async cancelContract(personId: number, contractId: number): Promise<Prisma.client_contractGetPayload<{}>> {
    return this.$transaction(async (tx) => {
      const contract = await tx.client_contract.findUnique({
        where: { contract_id: contractId },
      });

      if (!contract) {
        throw new NotFoundException(`Contrato con ID ${contractId} no encontrado.`);
      }
      if (contract.person_id !== personId) {
        throw new ForbiddenException('No tienes permiso para cancelar este contrato.');
      }
      if (contract.status === ContractStatus.CANCELLED || contract.status === ContractStatus.EXPIRED) {
        throw new BadRequestException('El contrato ya está cancelado o expirado.');
      }
      if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.PENDING_ACTIVATION) {
        throw new BadRequestException(`El contrato está en estado ${contract.status} y no se puede cancelar desde este estado.`);
      }

      const effectiveEndDate = new Date();

      const updatedContract = await tx.client_contract.update({
        where: { contract_id: contractId },
        data: {
          status: ContractStatus.CANCELLED,
          end_date: effectiveEndDate,
        },
      });

      await tx.order_header.updateMany({
        where: {
          contract_id: contractId,
          scheduled_delivery_date: { gt: effectiveEndDate },
          status: {
            in: [PrismaOrderStatus.PENDING, PrismaOrderStatus.PROCESSING],
          },
        },
        data: {
          status: PrismaOrderStatus.CANCELLED,
        },
      });
      return updatedContract;
    });
  }

  async changeContractPriceList(personId: number, dto: ChangeContractPriceListDto): Promise<Prisma.client_contractGetPayload<{}>> {
    return this.$transaction(async (tx) => {
      const currentContract = await tx.client_contract.findUnique({
        where: { contract_id: dto.current_contract_id },
      });

      if (!currentContract) {
        throw new NotFoundException(`Contrato actual con ID ${dto.current_contract_id} no encontrado.`);
      }
      if (currentContract.person_id !== personId) {
        throw new ForbiddenException('No tienes permiso para modificar este contrato.');
      }
      if (currentContract.status !== ContractStatus.ACTIVE) {
        throw new BadRequestException(
          `El contrato actual está en estado ${currentContract.status} y no se puede cambiar. Solo se pueden cambiar contratos ACTIVOS.`,
        );
      }

      const newPriceList = await tx.price_list.findUnique({
        where: { price_list_id: dto.new_price_list_id },
      });
      if (!newPriceList) {
        throw new NotFoundException(`Nueva lista de precios con ID ${dto.new_price_list_id} no encontrada.`);
      }
      if (currentContract.price_list_id === dto.new_price_list_id) {
        throw new BadRequestException('El contrato actual ya utiliza esta lista de precios.');
      }

      const oldContractEffectiveEndDate = new Date();
      oldContractEffectiveEndDate.setHours(23, 59, 59, 999);

      const newContractStartDate = new Date(oldContractEffectiveEndDate);
      newContractStartDate.setDate(oldContractEffectiveEndDate.getDate() + 1);
      newContractStartDate.setHours(0, 0, 0, 0);

      const newContractEndDate = new Date(newContractStartDate);
      newContractEndDate.setFullYear(newContractStartDate.getFullYear() + 1);
      newContractEndDate.setDate(newContractStartDate.getDate() - 1);
      newContractEndDate.setHours(23, 59, 59, 999);

      await tx.client_contract.update({
        where: { contract_id: dto.current_contract_id },
        data: {
          status: ContractStatus.CANCELLED,
          end_date: oldContractEffectiveEndDate,
          notes: `${currentContract.notes || ''} - Reemplazado por lista de precios ${dto.new_price_list_id} el ${new Date().toISOString()}`.trim(),
        },
      });

      await tx.order_header.updateMany({
        where: {
          contract_id: dto.current_contract_id,
          scheduled_delivery_date: { gt: oldContractEffectiveEndDate },
          status: {
            in: [PrismaOrderStatus.PENDING, PrismaOrderStatus.PROCESSING],
          },
        },
        data: { status: PrismaOrderStatus.CANCELLED },
      });

      const newContract = await tx.client_contract.create({
        data: {
          person_id: personId,
          price_list_id: dto.new_price_list_id,
          start_date: newContractStartDate,
          end_date: newContractEndDate, 
          status: ContractStatus.ACTIVE,
          notes: `Iniciado por cambio desde contrato ID ${dto.current_contract_id}`,
        },
      });
      return newContract;
    });
  }

  async getPublicLoanedProductsByPerson(personId: number): Promise<LoanedProductDto[]> {
    await this.findPersonById(personId);
    return this.getLoanedProducts(personId);
  }
}
