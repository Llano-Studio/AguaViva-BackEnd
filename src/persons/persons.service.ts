import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient, Prisma, SubscriptionStatus, OrderStatus as PrismaOrderStatus, ContractStatus, person, locality, zone, province, PersonType } from '@prisma/client';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { LoanedProductDto, PersonResponseDto } from './dto/person-response.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { ChangeContractPriceListDto } from './dto/change-contract-price-list.dto';
import { FilterPersonsDto } from './dto/filter-persons.dto';

@Injectable()
export class PersonsService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  private async getPaymentSemaphoreStatus(personId: number): Promise<string> {
    try {
      const activeSubscription = await this.customer_subscription.findFirst(
        {
          where: {
            customer_id: personId,
            status: SubscriptionStatus.ACTIVE
          },
          orderBy: {
            start_date: 'desc'
          },
          include: {
            subscription_cycle: {
              orderBy: {
                cycle_end: 'desc'
              },
              take: 1
            }
          },
        }
      );

      if (!activeSubscription?.subscription_cycle?.length) return 'NONE';

      const lastCycle = activeSubscription.subscription_cycle[0];
      const cycleEndDate = new Date(lastCycle.cycle_end);

      const today = new Date(); today.setHours(0, 0, 0, 0);

      if (cycleEndDate < today) {
        const diffTime = today.getTime() - cycleEndDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return 'RED';
        if (diffDays > 5) return 'YELLOW';
        return 'GREEN';
      }
      return 'GREEN'; // Ciclo no vencido
    } catch (error) {
      console.error(`Error calculating semaphore for person ${personId}:`, error);
      return 'NONE';
    }
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
    paymentSemaphoreStatus: string
  ): PersonResponseDto {
    return {
      person_id: personEntity.person_id,
      name: personEntity.name || '',
      phone: personEntity.phone,
      address: personEntity.address || '',
      localityId: personEntity.locality_id || 0,
      zoneId: personEntity.zone_id || 0,
      taxId: personEntity.tax_id || '',
      type: personEntity.type as any,
      registrationDate: personEntity.registration_date.toISOString(),
      registration_date: personEntity.registration_date,
      locality: personEntity.locality,
      zone: personEntity.zone,
      loaned_products: loanedProducts,
      payment_semaphore_status: paymentSemaphoreStatus,
    };
  }

  async createPerson(dto: CreatePersonDto): Promise<PersonResponseDto> {

    const locality = await this.locality.findUnique(
      {
        where: {
          locality_id: dto.localityId
        }
      });
    if (!locality)
      throw new BadRequestException(`Localidad ${dto.localityId} no encontrada`);

    const zone = await this.zone.findUnique(
      {
        where: {
          zone_id: dto.zoneId
        }
      });

    if (!zone) throw new BadRequestException(`Zona ${dto.zoneId} no encontrada`);

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
      registration_date: registration_date_for_prisma, // Puede ser Date o undefined
      locality: { connect: { locality_id: dto.localityId } },
      zone: { connect: { zone_id: dto.zoneId } },
      type: dto.type as PersonType,
    };

    try {
      const newPerson = await this.person.create({
        data,
        include: {
          locality: {
            include: {
              province: true
            }
          },
          zone: true
        }
      });
      const semaphoreStatus = await this.getPaymentSemaphoreStatus(newPerson.person_id);
      const loanedProducts = await this.getLoanedProducts(newPerson.person_id);

      return this.mapToPersonResponseDto(newPerson, loanedProducts, semaphoreStatus);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El teléfono ya está registrado para otra persona.');
      }
      console.error("Error creating person:", error);
      throw new InternalServerErrorException('Error al crear la persona.');
    }
  }

  async findAllPersons(filters: FilterPersonsDto): Promise<{ data: PersonResponseDto[], total: number, page: number, limit: number }> {
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
      payment_semaphore_status
    } = filters;

    const where: Prisma.personWhereInput = {};

    if (personId) where.person_id = personId;
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (address) where.address = { contains: address, mode: 'insensitive' };
    if (type) where.type = type as PersonType;
    if (phone) where.phone = { contains: phone, mode: 'insensitive' };
    if (taxId) where.tax_id = { contains: taxId, mode: 'insensitive' };
    if (localityId) where.locality_id = localityId;
    if (zoneId) where.zone_id = zoneId;

    try {
      // 1. Obtener TODAS las personas que coinciden con los filtros de BD
      const allPersonsFromDb = await this.person.findMany({
        where,
        include: {
          locality: {
            include: {
              province: true
            }
          },
          zone: true
        },
        orderBy: { name: 'asc' }
      });

      // 2. Procesar y filtrar en memoria por semáforo
      let processedAndFilteredPersons: PersonResponseDto[] = [];

      for (const person of allPersonsFromDb) {
        const semaphoreStatus = await this.getPaymentSemaphoreStatus(person.person_id);

        // 3. Si se aplica filtro de semáforo y no coincide, saltar esta persona
        if (payment_semaphore_status && semaphoreStatus !== payment_semaphore_status) {
          continue;
        }

        const loanedProducts = await this.getLoanedProducts(person.person_id);
        processedAndFilteredPersons.push(
          this.mapToPersonResponseDto(person, loanedProducts, semaphoreStatus)
        );
      }

      // 4. Aplicar paginación a la lista filtrada en memoria
      const totalFiltered = processedAndFilteredPersons.length;
      const skip = (page - 1) * limit;
      const paginatedData = processedAndFilteredPersons.slice(skip, skip + limit);

      return { data: paginatedData, total: totalFiltered, page, limit };

    } catch (error) {
      console.error("Error in findAllPersons:", error);
      throw new InternalServerErrorException('Error al obtener el listado de personas.')
    }
  }

  async findPersonById(id: number): Promise<PersonResponseDto> {
    const person = await this.person.findUnique({
      where: { person_id: id },
      include: {
        locality: {
          include: {
            province: true
          }
        },
        zone: true
      }
    });
    if (!person) throw new NotFoundException(`Persona ${id} no encontrada`);

    const semaphoreStatus = await this.getPaymentSemaphoreStatus(id);
    const loanedProducts = await this.getLoanedProducts(id);

    return this.mapToPersonResponseDto(person, loanedProducts, semaphoreStatus);
  }

  async findPersonByName(name: string): Promise<PersonResponseDto[]> {
    const persons = await this.person.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive'
        }
      },
      include: {
        locality: {
          include: {
            province: true
          }
        },
        zone: true
      }
    });
    return Promise.all(
      persons.map(async p => this.mapToPersonResponseDto(
        p,
        await this.getLoanedProducts(p.person_id),
        await this.getPaymentSemaphoreStatus(p.person_id)
      )
      )
    );
  }

  async findPersonByAddress(address: string): Promise<PersonResponseDto[]> {
    const persons = await this.person.findMany({
      where: { address: { contains: address, mode: 'insensitive' } },
      include: { locality: { include: { province: true } }, zone: true }
    });
    return Promise.all(persons.map(async p => this.mapToPersonResponseDto(p, await this.getLoanedProducts(p.person_id), await this.getPaymentSemaphoreStatus(p.person_id))));
  }

  async findPersonByType(type: string): Promise<PersonResponseDto[]> {
    const persons = await this.person.findMany({
      where: { type: type as PersonType }, // PersonType from @prisma/client
      include: { locality: { include: { province: true } }, zone: true },
    });
    return Promise.all(persons.map(async p => this.mapToPersonResponseDto(p, await this.getLoanedProducts(p.person_id), await this.getPaymentSemaphoreStatus(p.person_id))));
  }

  async updatePerson(id: number, dto: UpdatePersonDto): Promise<PersonResponseDto> {
    const existingPerson = await this.person.findUnique({ where: { person_id: id } });
    if (!existingPerson) throw new NotFoundException(`Persona con ID ${id} no encontrada.`);

    // Validaciones para localityId y zoneId si se proporcionan en el DTO
    if (dto.localityId) {
      const locality = await this.locality.findUnique({ where: { locality_id: dto.localityId } });
      if (!locality) throw new BadRequestException(`Localidad con ID ${dto.localityId} no encontrada.`);
    }
    if (dto.zoneId) {
      const zone = await this.zone.findUnique({ where: { zone_id: dto.zoneId } });
      if (!zone) throw new BadRequestException(`Zona con ID ${dto.zoneId} no encontrada.`);
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
    if (dto.type !== undefined) dataToUpdate.type = dto.type as PersonType; 

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
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002' &&
        error.meta?.target && Array.isArray(error.meta.target) && error.meta.target.includes('phone')) {
        throw new ConflictException('El teléfono ya está registrado para otra persona.');
      }
      console.error(`Error updating person ${id}:`, error);
      throw new InternalServerErrorException('Error al actualizar la persona.');
    }
  }

  async deletePerson(id: number) {
    await this.findPersonById(id);
    return this.person.delete({ where: { person_id: id } });
  }

  async cancelSubscription(personId: number, subscriptionId: number) {
    return this.$transaction(async (tx) => {
      // Paso 1: Validaciones Iniciales y obtener la suscripción
      const subscription = await tx.customer_subscription.findUnique({
        where: { subscription_id: subscriptionId },
        include: {
          subscription_cycle: {
            orderBy: { cycle_end: 'desc' }, // Obtener el último ciclo primero
            take: 1, // Solo necesitamos el más reciente para determinar el fin del ciclo actual
          },
        },
      });

      if (!subscription) {
        throw new NotFoundException(`Suscripción con ID ${subscriptionId} no encontrada.`);
      }

      if (subscription.customer_id !== personId) {
        throw new ForbiddenException('No tienes permiso para cancelar esta suscripción.');
      }

      if (subscription.status === SubscriptionStatus.CANCELLED || subscription.status === SubscriptionStatus.EXPIRED) {
        throw new BadRequestException('La suscripción ya está cancelada o expirada.');
      }

      if (subscription.status !== SubscriptionStatus.ACTIVE && subscription.status !== SubscriptionStatus.PAUSED) {
        throw new BadRequestException(`La suscripción está en estado ${subscription.status} y no se puede cancelar desde este estado.`);
      }

      // Paso 2: Determinar la Fecha de Finalización del Ciclo Actual
      if (!subscription.subscription_cycle || subscription.subscription_cycle.length === 0) {
        // Esto podría indicar un problema de datos si una suscripción activa/pausada no tiene ciclos.
        // O podría ser una suscripción que nunca tuvo un ciclo iniciado.
        // Por ahora, si no hay ciclo, la cancelamos inmediatamente.
        // Considera si esta es la lógica de negocio deseada.
        console.warn(`Suscripción ${subscriptionId} no tiene ciclos de suscripción. Se cancelará con fecha de finalización inmediata.`);
      }

      const endDateOfCurrentCycle = subscription.subscription_cycle?.[0]?.cycle_end || new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const effectiveEndDate = endDateOfCurrentCycle < today ? today : endDateOfCurrentCycle;

      // Paso 4a: Actualizar customer_subscription
      const updatedSubscription = await tx.customer_subscription.update({
        where: { subscription_id: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          end_date: effectiveEndDate,
        },
      });

      // Paso 4b: Actualizar order_header futuros
      await tx.order_header.updateMany({
        where: {
          subscription_id: subscriptionId,
          scheduled_delivery_date: { gt: effectiveEndDate }, // Pedidos programados DESPUÉS del fin del ciclo actual
          status: {
            in: [PrismaOrderStatus.PENDING, PrismaOrderStatus.PROCESSING], // Solo cancelar pedidos en estos estados
          },
        },
        data: {
          status: PrismaOrderStatus.CANCELLED,
        },
      });

      return updatedSubscription;
    });
  }

  async changeSubscriptionPlan(personId: number, dto: ChangeSubscriptionPlanDto) {
    return this.$transaction(async (tx) => {
      // 1. Validar y obtener la suscripción actual
      const currentSubscription = await tx.customer_subscription.findUnique({
        where: { subscription_id: dto.current_subscription_id },
        include: {
          subscription_cycle: {
            orderBy: { cycle_end: 'desc' },
            take: 1, // El ciclo más reciente (activo o el último completado)
          },
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

      // 2. Validar el nuevo plan de suscripción
      const newPlan = await tx.subscription_plan.findUnique({
        where: { subscription_plan_id: dto.new_plan_id },
      });

      if (!newPlan) {
        throw new NotFoundException(`Nuevo plan de suscripción con ID ${dto.new_plan_id} no encontrado.`);
      }

      if (dto.current_subscription_id === dto.new_plan_id && currentSubscription.subscription_plan_id === dto.new_plan_id) {
        throw new BadRequestException('La suscripción actual ya tiene el plan seleccionado.');
      }

      // 3. Determinar fechas de finalización para la antigua y de inicio para la nueva
      let oldSubscriptionEndDate = new Date(); // Por defecto, hoy
      if (currentSubscription.subscription_cycle && currentSubscription.subscription_cycle.length > 0) {
        const currentCycle = currentSubscription.subscription_cycle[0];
        oldSubscriptionEndDate = new Date(currentCycle.cycle_end);
      } else {
        // Si no hay ciclo, se asume que finaliza hoy. Podría ser una suscripción recién creada sin ciclos aún.
        console.warn(`Suscripción actual ${dto.current_subscription_id} no tiene ciclos. Se considerará que finaliza hoy.`);
      }
      // Asegurarse que la fecha de fin no sea en el pasado respecto a hoy, si el ciclo ya terminó.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (oldSubscriptionEndDate < today) oldSubscriptionEndDate = today;

      const newSubscriptionStartDate = new Date(oldSubscriptionEndDate);
      newSubscriptionStartDate.setDate(oldSubscriptionEndDate.getDate() + 1); // Inicia al día siguiente
      newSubscriptionStartDate.setHours(0, 0, 0, 0);

      // 4. Actualizar la suscripción antigua
      await tx.customer_subscription.update({
        where: { subscription_id: dto.current_subscription_id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          end_date: oldSubscriptionEndDate,
          notes: currentSubscription.notes ? `${currentSubscription.notes} - Reemplazada por plan ${dto.new_plan_id} el ${new Date().toISOString()}` : `Reemplazada por plan ${dto.new_plan_id} el ${new Date().toISOString()}`,
        },
      });

      // 5. Cancelar pedidos futuros de la suscripción antigua
      await tx.order_header.updateMany({
        where: {
          subscription_id: dto.current_subscription_id,
          scheduled_delivery_date: { gt: oldSubscriptionEndDate },
          status: { in: [PrismaOrderStatus.PENDING, PrismaOrderStatus.PROCESSING] },
        },
        data: { status: PrismaOrderStatus.CANCELLED },
      });

      // 6. Crear la nueva suscripción
      const newSubscription = await tx.customer_subscription.create({
        data: {
          customer_id: personId,
          subscription_plan_id: dto.new_plan_id,
          start_date: newSubscriptionStartDate,
          status: SubscriptionStatus.ACTIVE,
          notes: `Iniciada por cambio desde suscripción ID ${dto.current_subscription_id}`,
          // end_date se deja null por defecto para suscripciones continuas
        },
      });

      // 7. Crear el primer ciclo para la nueva suscripción (asumiendo 1 mes de duración)
      const firstCycleStartDate = new Date(newSubscriptionStartDate);
      const firstCycleEndDate = new Date(firstCycleStartDate);
      firstCycleEndDate.setMonth(firstCycleStartDate.getMonth() + 1);
      firstCycleEndDate.setDate(firstCycleStartDate.getDate() - 1); // Para que sea justo un mes menos un día.
      firstCycleEndDate.setHours(23, 59, 59, 999);

      await tx.subscription_cycle.create({
        data: {
          subscription_id: newSubscription.subscription_id,
          cycle_start: firstCycleStartDate,
          cycle_end: firstCycleEndDate,
          notes: 'Primer ciclo post cambio de plan.',
        },
      });

      return newSubscription; // Devolver la nueva suscripción creada
    });
  }

  async cancelContract(personId: number, contractId: number) {
    return this.$transaction(async (tx) => {
      // Paso 1: Validaciones Iniciales y obtener el contrato
      const contract = await tx.client_contract.findUnique({
        where: { contract_id: contractId },
      });

      if (!contract) {
        throw new NotFoundException(`Contrato con ID ${contractId} no encontrado.`);
      }

      if (contract.person_id !== personId) {
        throw new ForbiddenException('No tienes permiso para cancelar este contrato.');
      }

      // Usamos el enum ContractStatus que definimos antes
      if (contract.status === ContractStatus.CANCELLED || contract.status === ContractStatus.EXPIRED) {
        throw new BadRequestException('El contrato ya está cancelado o expirado.');
      }

      // Definir qué estados son cancelables. Por ejemplo, ACTIVE y PENDING_ACTIVATION.
      // Ajusta esto según tu lógica de negocio.
      if (contract.status !== ContractStatus.ACTIVE && contract.status !== ContractStatus.PENDING_ACTIVATION) {
        throw new BadRequestException(`El contrato está en estado ${contract.status} y no se puede cancelar desde este estado.`);
      }

      // Paso 2: Determinar la Fecha de Finalización efectiva
      // Para los contratos, generalmente la cancelación es efectiva inmediatamente.
      // La end_date del contrato se actualizará a la fecha actual.
      const effectiveEndDate = new Date();

      // Paso 4a: Actualizar client_contract
      const updatedContract = await tx.client_contract.update({
        where: { contract_id: contractId },
        data: {
          status: ContractStatus.CANCELLED,
          end_date: effectiveEndDate, // Actualizar la fecha de finalización del contrato
        },
      });

      // Paso 4b: Actualizar order_header futuros asociados al contrato
      // Asumimos que los pedidos de contrato se identifican por el contract_id en order_header
      // y son de tipo CONTRACT_DELIVERY
      await tx.order_header.updateMany({
        where: {
          contract_id: contractId,
          // order_type: OrderType.CONTRACT_DELIVERY, // Descomentar si quieres ser específico con el tipo de pedido
          scheduled_delivery_date: { gt: effectiveEndDate }, // Pedidos programados DESPUÉS de la cancelación
          status: {
            in: [PrismaOrderStatus.PENDING, PrismaOrderStatus.PROCESSING], // Solo cancelar pedidos en estos estados
          },
        },
        data: {
          status: PrismaOrderStatus.CANCELLED,
        },
      });

      return updatedContract;
    });
  }

  async changeContractPriceList(personId: number, dto: ChangeContractPriceListDto) {
    return this.$transaction(async (tx) => {
      // 1. Validar y obtener el contrato actual
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
        // Solo permitimos cambiar contratos ACTIVOS. Ajustar si otros estados también son válidos.
        throw new BadRequestException(
          `El contrato actual está en estado ${currentContract.status} y no se puede cambiar. Solo se pueden cambiar contratos ACTIVOS.`,
        );
      }

      // 2. Validar la nueva lista de precios
      const newPriceList = await tx.price_list.findUnique({
        where: { price_list_id: dto.new_price_list_id },
      });

      if (!newPriceList) {
        throw new NotFoundException(`Nueva lista de precios con ID ${dto.new_price_list_id} no encontrada.`);
      }

      if (currentContract.price_list_id === dto.new_price_list_id) {
        throw new BadRequestException('El contrato actual ya utiliza esta lista de precios.');
      }

      // 3. Determinar fechas
      // El contrato antiguo finaliza hoy, ya que el cliente puede cambiar cuando quiera.
      const oldContractEffectiveEndDate = new Date();
      oldContractEffectiveEndDate.setHours(23, 59, 59, 999); // Fin del día de hoy

      const newContractStartDate = new Date(oldContractEffectiveEndDate);
      newContractStartDate.setDate(oldContractEffectiveEndDate.getDate() + 1);
      newContractStartDate.setHours(0, 0, 0, 0); // Inicio del día siguiente

      // El nuevo contrato dura 12 meses desde su inicio
      const newContractEndDate = new Date(newContractStartDate);
      newContractEndDate.setFullYear(newContractStartDate.getFullYear() + 1);
      newContractEndDate.setDate(newContractStartDate.getDate() - 1); // Ajuste para que sea justo un año menos un día
      newContractEndDate.setHours(23, 59, 59, 999);


      // 4. Actualizar el contrato antiguo
      await tx.client_contract.update({
        where: { contract_id: dto.current_contract_id },
        data: {
          status: ContractStatus.CANCELLED, // O un estado como REPLACED si lo tuvieras
          end_date: oldContractEffectiveEndDate,
          notes: currentContract.notes ? `${currentContract.notes} - Reemplazado por lista de precios ${dto.new_price_list_id} el ${new Date().toISOString()}` : `Reemplazado por lista de precios ${dto.new_price_list_id} el ${new Date().toISOString()}`,
        },
      });

      // 5. Cancelar pedidos futuros del contrato antiguo
      await tx.order_header.updateMany({
        where: {
          contract_id: dto.current_contract_id,
          // order_type: OrderType.CONTRACT_DELIVERY, // Descomentar si quieres ser específico con el tipo de pedido
          scheduled_delivery_date: { gt: oldContractEffectiveEndDate },
          status: {
            in: [PrismaOrderStatus.PENDING, PrismaOrderStatus.PROCESSING], // Solo cancelar pedidos en estos estados
          },
        },
        data: { status: PrismaOrderStatus.CANCELLED },
      });

      // 6. Crear el nuevo contrato
      const newContract = await tx.client_contract.create({
        data: {
          person_id: personId,
          price_list_id: dto.new_price_list_id,
          start_date: newContractStartDate,
          end_date: newContractEndDate, // Nuevo contrato con duración de 12 meses
          status: ContractStatus.ACTIVE,
          notes: `Iniciado por cambio desde contrato ID ${dto.current_contract_id}`,
        },
      });

      return newContract; // Devolver el nuevo contrato creado
    });
  }

  async getPublicLoanedProductsByPerson(personId: number): Promise<LoanedProductDto[]> {
      
    await this.findPersonById(personId);
    return this.getLoanedProducts(personId);
  }
}
