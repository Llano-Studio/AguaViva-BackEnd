import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ConflictException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
  SubscriptionStatus,
  OrderStatus as PrismaOrderStatus,
  ContractStatus,
  person,
  locality,
  zone,
  province,
  country,
  PersonType as PrismaPersonType,
  ComodatoStatus,
  comodato,
  customer_subscription,
  subscription_plan,
} from '@prisma/client';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  LoanedProductDetailDto,
  PersonResponseDto,
} from './dto/person-response.dto';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { ChangeContractPriceListDto } from './dto/change-contract-price-list.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { FilterPersonsDto } from './dto/filter-persons.dto';
import {
  CreateComodatoDto,
  UpdateComodatoDto,
  FilterComodatosDto,
  ComodatoResponseDto,
  CreateSubscriptionWithComodatoDto,
} from './dto';
import { WithdrawComodatoDto } from './dto/withdraw-comodato.dto';
import { WithdrawComodatoResponseDto } from './dto/withdraw-comodato-response.dto';
import { CustomerSubscriptionService } from '../customer-subscription/customer-subscription.service';
import { CreateCustomerSubscriptionDto } from '../customer-subscription/dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { buildImageUrl } from '../common/utils/file-upload.util';
import { PaymentSemaphoreStatus } from '../common/config/business.config';
import { PaymentSemaphoreService } from '../common/services/payment-semaphore.service';
import { SubscriptionQuotaService } from '../common/services/subscription-quota.service';
import { CancellationOrderService } from '../orders/cancellation-order.service';
import { InventoryService } from '../inventory/inventory.service';
import { RecoveryOrderService } from '../common/services/recovery-order.service';
import { BUSINESS_CONFIG } from '../common/config/business.config';
import { SubscriptionCycleCalculatorService } from '../common/services/subscription-cycle-calculator.service';

@Injectable()
export class PersonsService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Persona';

  constructor(
    private readonly paymentSemaphoreService: PaymentSemaphoreService,
    private readonly customerSubscriptionService: CustomerSubscriptionService,
    private readonly subscriptionQuotaService: SubscriptionQuotaService,
    private readonly cancellationOrderService: CancellationOrderService,
    private readonly inventoryService: InventoryService,
    private readonly recoveryOrderService: RecoveryOrderService,
    private readonly cycleCalculatorService: SubscriptionCycleCalculatorService,
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  private async getPaymentSemaphoreStatus(
    personId: number,
  ): Promise<PaymentSemaphoreStatus> {
    return this.paymentSemaphoreService.getPaymentSemaphoreStatus(personId);
  }

  private async getAvailableCredits(personId: number): Promise<
    {
      product_id: number;
      product_description: string;
      planned_quantity: number;
      delivered_quantity: number;
      remaining_balance: number;
    }[]
  > {
    try {
      // Buscar suscripciones activas del cliente
      const activeSubscriptions = await this.customer_subscription.findMany({
        where: {
          customer_id: personId,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (activeSubscriptions.length === 0) {
        return [];
      }

      // Obtener créditos de todas las suscripciones activas
      const allCredits: {
        product_id: number;
        product_description: string;
        planned_quantity: number;
        delivered_quantity: number;
        remaining_balance: number;
      }[] = [];

      for (const subscription of activeSubscriptions) {
        const credits = await this.subscriptionQuotaService.getAvailableCredits(
          subscription.subscription_id,
        );
        allCredits.push(
          ...credits.map((credit) => ({
            product_id: credit.product_id,
            product_description: credit.product_description,
            planned_quantity: credit.planned_quantity,
            delivered_quantity: credit.delivered_quantity,
            remaining_balance: credit.remaining_balance,
          })),
        );
      }

      return allCredits;
    } catch (error) {
      console.error(
        `Error obteniendo créditos disponibles para persona ${personId}:`,
        error,
      );
      return [];
    }
  }

  private mapToPersonResponseDto(
    personEntity: person & {
      locality?:
        | (locality & { province?: province & { country?: country } })
        | null;
      zone?: zone | null;
    },
    loanedProductsDetail: LoanedProductDetailDto[],
    paymentSemaphoreStatus: PaymentSemaphoreStatus,
    availableCredits: {
      product_id: number;
      product_description: string;
      planned_quantity: number;
      delivered_quantity: number;
      remaining_balance: number;
    }[],
  ): PersonResponseDto {
    return {
      person_id: personEntity.person_id,
      name: personEntity.name || '',
      alias: personEntity.alias || '',
      phone: personEntity.phone,
      additionalPhones: personEntity.additional_phones || '',
      address: personEntity.address || '',
      localityId:
        personEntity.locality_id === null ? 0 : personEntity.locality_id,
      zoneId: personEntity.zone_id === null ? 0 : personEntity.zone_id,
      taxId: personEntity.tax_id || '',
      type: personEntity.type as any,
      registration_date: personEntity.registration_date,
      locality: personEntity.locality as any,
      zone: personEntity.zone as any,
      is_active: personEntity.is_active,
      owns_returnable_containers: personEntity.owns_returnable_containers,
      notes: personEntity.notes || '',
      loaned_products_detail: loanedProductsDetail,
      payment_semaphore_status: paymentSemaphoreStatus,
      available_credits: availableCredits,
    };
  }

  async createPerson(dto: CreatePersonDto): Promise<PersonResponseDto> {
    if (dto.localityId) {
      const localityExists = await this.locality.findUnique({
        where: { locality_id: dto.localityId },
      });
      if (!localityExists)
        throw new BadRequestException(
          `Localidad con ID ${dto.localityId} no encontrada.`,
        );
    }

    if (dto.zoneId) {
      const zoneExists = await this.zone.findUnique({
        where: { zone_id: dto.zoneId },
      });
      if (!zoneExists)
        throw new BadRequestException(
          `Zona con ID ${dto.zoneId} no encontrada.`,
        );
    }

    let registration_date_for_prisma: Date | undefined = undefined;
    if (dto.registrationDate) {
      const parsedDate = new Date(dto.registrationDate);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException(
          'registrationDate inválido: formato incorrecto.',
        );
      }
      registration_date_for_prisma = parsedDate;
    }

    const data: Prisma.personCreateInput = {
      name: dto.name,
      alias: dto.alias,
      phone: dto.phone,
      additional_phones: dto.additionalPhones,
      address: dto.address,
      tax_id: dto.taxId,
      registration_date: registration_date_for_prisma,
      type: dto.type as PrismaPersonType,
      is_active: dto.is_active !== undefined ? dto.is_active : true,
      notes: dto.notes,
      owns_returnable_containers:
        dto.owns_returnable_containers !== undefined
          ? dto.owns_returnable_containers
          : false,
    };
    if (dto.localityId)
      data.locality = { connect: { locality_id: dto.localityId } };
    if (dto.zoneId) data.zone = { connect: { zone_id: dto.zoneId } };

    try {
      const newPerson = await this.person.create({
        data,
        include: {
          locality: {
            include: {
              province: {
                include: {
                  country: true,
                },
              },
            },
          },
          zone: true,
        },
      });
      const semaphoreStatus = await this.getPaymentSemaphoreStatus(
        newPerson.person_id,
      );
      const loanedProductsDetail = await this.getLoanedProductsDetail(
        newPerson.person_id,
      );
      const availableCredits = await this.getAvailableCredits(
        newPerson.person_id,
      );

      return this.mapToPersonResponseDto(
        newPerson,
        loanedProductsDetail,
        semaphoreStatus,
        availableCredits,
      );
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `El teléfono '${dto.phone}' ya está registrado para otra ${this.entityName.toLowerCase()}.`,
        );
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async findAllPersons(filters: FilterPersonsDto): Promise<{
    data: PersonResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      name,
      alias,
      address,
      type,
      types,
      personId,
      phone,
      taxId,
      localityId,
      localityIds,
      zoneId,
      zoneIds,
      payment_semaphore_status,
      payment_semaphore_statuses,
      is_active,
      sortBy,
    } = filters;

    // Unificar posibles alias del filtro de actividad
    const isActiveFilterInput =
      is_active !== undefined
        ? is_active
        : (filters as any).isActive !== undefined
        ? (filters as any).isActive
        : (filters as any).active !== undefined
        ? (filters as any).active
        : undefined;

    const where: Prisma.personWhereInput = {
      is_active:
        isActiveFilterInput !== undefined ? isActiveFilterInput : true, // Por defecto solo personas activas, pero permite filtrar inactivas
    };

    // Búsqueda general en múltiples campos (como en auth.service.ts)
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { alias: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { tax_id: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtros específicos (se pueden combinar con search)
    if (personId) where.person_id = personId;
    if (name) where.name = { contains: name, mode: 'insensitive' };
    if (alias) where.alias = { contains: alias, mode: 'insensitive' };
    if (address) where.address = { contains: address, mode: 'insensitive' };
    if (phone) where.phone = { contains: phone, mode: 'insensitive' };
    if (taxId) where.tax_id = { contains: taxId, mode: 'insensitive' };
    // Manejar filtrado por tipos (múltiples o único)
    if (types && types.length > 0) {
      // Si se proporcionan múltiples tipos, usar operador IN
      where.type = { in: types as PrismaPersonType[] };
    } else if (type) {
      // Si solo se proporciona un tipo (compatibilidad), usar equality
      where.type = type as PrismaPersonType;
    }

    // Manejar filtrado por localidades (múltiples o única)
    if (localityIds && localityIds.length > 0) {
      // Si se proporcionan múltiples localidades, usar operador IN
      where.locality_id = { in: localityIds };
    } else if (localityId) {
      // Si solo se proporciona una localidad (compatibilidad), usar equality
      where.locality_id = localityId;
    }

    // Manejar filtrado por zonas (múltiples o única)
    if (zoneIds && zoneIds.length > 0) {
      // Si se proporcionan múltiples zonas, usar operador IN
      where.zone_id = { in: zoneIds };
    } else if (zoneId) {
      // Si solo se proporciona una zona (compatibilidad), usar equality
      where.zone_id = zoneId;
    }

    // Verificar si se debe ordenar por semáforo
    const shouldSortBySemaphore =
      sortBy && sortBy.includes('payment_semaphore_status');

    // Separar campos de ordenamiento del semáforo y otros campos
    let semaphoreSortDirection: 'asc' | 'desc' = 'asc';
    let otherSortFields = sortBy;

    if (shouldSortBySemaphore && sortBy) {
      const sortFields = sortBy.split(',').map((field) => field.trim());
      const nonSemaphoreFields: string[] = [];

      for (const field of sortFields) {
        if (
          field === 'payment_semaphore_status' ||
          field === '-payment_semaphore_status'
        ) {
          semaphoreSortDirection = field.startsWith('-') ? 'desc' : 'asc';
        } else {
          nonSemaphoreFields.push(field);
        }
      }

      otherSortFields =
        nonSemaphoreFields.length > 0
          ? nonSemaphoreFields.join(',')
          : undefined;
    }

    const orderByClause = parseSortByString(otherSortFields, [{ name: 'asc' }]);

    try {
      // Si se filtra por semáforo O se ordena por semáforo, necesitamos obtener todas las personas para calcular el semáforo
      if (
        payment_semaphore_status ||
        payment_semaphore_statuses ||
        shouldSortBySemaphore
      ) {
        const allPersonsFromDb = await this.person.findMany({
          where,
          include: {
            locality: {
              include: {
                province: {
                  include: {
                    country: true,
                  },
                },
              },
            },
            zone: true,
          },
          orderBy: orderByClause,
        });

        // Pre-calcular semáforos en lotes para mejor rendimiento
        const personIds = allPersonsFromDb.map((p) => p.person_id);
        const semaphoreMap =
          await this.paymentSemaphoreService.preCalculateForPersons(personIds);

        // Procesar todas las personas con semáforos
        const processedPersons: PersonResponseDto[] = [];
        for (const person of allPersonsFromDb) {
          const semaphoreStatus = semaphoreMap.get(person.person_id) || 'NONE';

          // Si hay filtro por semáforo (múltiples o único), aplicar filtro
          if (
            payment_semaphore_statuses &&
            payment_semaphore_statuses.length > 0
          ) {
            // Filtro múltiple: verificar si el estado está en la lista
            if (!payment_semaphore_statuses.includes(semaphoreStatus)) {
              continue;
            }
          } else if (
            payment_semaphore_status &&
            semaphoreStatus !== payment_semaphore_status
          ) {
            // Filtro único (compatibilidad)
            continue;
          }

          const loanedProductsDetail = await this.getLoanedProductsDetail(
            person.person_id,
          );
          const availableCredits = await this.getAvailableCredits(
            person.person_id,
          );
          processedPersons.push(
            this.mapToPersonResponseDto(
              person,
              loanedProductsDetail,
              semaphoreStatus,
              availableCredits,
            ),
          );
        }

        // Ordenar por semáforo si es necesario
        if (shouldSortBySemaphore) {
          const semaphoreOrder = ['NONE', 'GREEN', 'YELLOW', 'RED'];
          processedPersons.sort((a, b) => {
            const aIndex = semaphoreOrder.indexOf(a.payment_semaphore_status);
            const bIndex = semaphoreOrder.indexOf(b.payment_semaphore_status);

            const result =
              semaphoreSortDirection === 'asc'
                ? aIndex - bIndex
                : bIndex - aIndex;

            // Si los semáforos son iguales, mantener el orden existente (por nombre u otros campos)
            return result !== 0 ? result : 0;
          });
        }

        const totalFiltered = processedPersons.length;
        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);
        const paginatedData = processedPersons.slice(skip, skip + take);

        return {
          data: paginatedData,
          meta: {
            total: totalFiltered,
            page,
            limit: take,
            totalPages: Math.ceil(totalFiltered / take),
          },
        };
      } else {
        // Sin filtro de semáforo ni ordenamiento por semáforo, podemos aplicar paginación directamente en la BD
        const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
        const take = Math.max(1, limit);

        const [totalCount, personsFromDb] = await Promise.all([
          this.person.count({ where }),
          this.person.findMany({
            where,
            include: {
              locality: {
                include: {
                  province: {
                    include: {
                      country: true,
                    },
                  },
                },
              },
              zone: true,
            },
            orderBy: orderByClause,
            skip,
            take,
          }),
        ]);

        // Pre-calcular semáforos en lotes para mejor rendimiento
        const personIds = personsFromDb.map((p) => p.person_id);
        const semaphoreMap =
          await this.paymentSemaphoreService.preCalculateForPersons(personIds);

        // Procesar personas con semáforos pre-calculados
        const processedPersons: PersonResponseDto[] = [];
        for (const person of personsFromDb) {
          const semaphoreStatus = semaphoreMap.get(person.person_id) || 'NONE';

          const loanedProductsDetail = await this.getLoanedProductsDetail(
            person.person_id,
          );
          const availableCredits = await this.getAvailableCredits(
            person.person_id,
          );
          processedPersons.push(
            this.mapToPersonResponseDto(
              person,
              loanedProductsDetail,
              semaphoreStatus,
              availableCredits,
            ),
          );
        }

        return {
          data: processedPersons,
          meta: {
            total: totalCount,
            page,
            limit: take,
            totalPages: Math.ceil(totalCount / take),
          },
        };
      }
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        `Error obteniendo listado de ${this.entityName.toLowerCase()}s.`,
      );
    }
  }

  async findPersonById(id: number): Promise<PersonResponseDto> {
    const person = await this.person.findUnique({
      where: {
        person_id: id,
        is_active: true, // Solo buscar personas activas
      },
      include: {
        locality: {
          include: {
            province: {
              include: {
                country: true,
              },
            },
          },
        },
        zone: true,
      },
    });
    if (!person)
      throw new NotFoundException(
        `${this.entityName} con ID ${id} no encontrada.`,
      );

    const semaphoreStatus = await this.getPaymentSemaphoreStatus(id);

    const loanedProductsDetail = await this.getLoanedProductsDetail(id);
    const availableCredits = await this.getAvailableCredits(id);

    return this.mapToPersonResponseDto(
      person,
      loanedProductsDetail,
      semaphoreStatus,
      availableCredits,
    );
  }

  async updatePerson(
    id: number,
    dto: UpdatePersonDto,
  ): Promise<PersonResponseDto> {
    const existingPerson = await this.person.findUnique({
      where: {
        person_id: id,
        is_active: true, // Solo permitir actualizar personas activas
      },
    });
    if (!existingPerson)
      throw new NotFoundException(
        `${this.entityName} con ID ${id} no encontrada.`,
      );

    if (dto.localityId) {
      const localityExists = await this.locality.findUnique({
        where: { locality_id: dto.localityId },
      });
      if (!localityExists)
        throw new BadRequestException(
          `Localidad con ID ${dto.localityId} no encontrada.`,
        );
    }
    if (dto.zoneId) {
      const zoneExists = await this.zone.findUnique({
        where: { zone_id: dto.zoneId },
      });
      if (!zoneExists)
        throw new BadRequestException(
          `Zona con ID ${dto.zoneId} no encontrada.`,
        );
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
    if (dto.alias !== undefined) dataToUpdate.alias = dto.alias;
    if (dto.phone !== undefined) dataToUpdate.phone = dto.phone;
    if (dto.additionalPhones !== undefined)
      dataToUpdate.additional_phones = dto.additionalPhones;
    if (dto.address !== undefined) dataToUpdate.address = dto.address;
    if (dto.taxId !== undefined) dataToUpdate.tax_id = dto.taxId;
    if (dto.type !== undefined)
      dataToUpdate.type = dto.type as PrismaPersonType;
    if (dto.is_active !== undefined) dataToUpdate.is_active = dto.is_active;
    if (dto.notes !== undefined) dataToUpdate.notes = dto.notes;
    if (dto.owns_returnable_containers !== undefined)
      dataToUpdate.owns_returnable_containers = dto.owns_returnable_containers;
    dataToUpdate.registration_date =
      registration_date_obj ?? existingPerson.registration_date;

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
        include: {
          locality: {
            include: {
              province: {
                include: {
                  country: true,
                },
              },
            },
          },
          zone: true,
        },
      });
      const semaphoreStatus = await this.getPaymentSemaphoreStatus(
        updatedPerson.person_id,
      );
      const loanedProductsDetail = await this.getLoanedProductsDetail(
        updatedPerson.person_id,
      );
      const availableCredits = await this.getAvailableCredits(
        updatedPerson.person_id,
      );
      return this.mapToPersonResponseDto(
        updatedPerson,
        loanedProductsDetail,
        semaphoreStatus,
        availableCredits,
      );
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `El teléfono '${dto.phone ?? existingPerson.phone}' ya está registrado para otra ${this.entityName.toLowerCase()}.`,
        );
      }
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async deletePerson(
    id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    await this.findPersonById(id);
    try {
      // Implementar borrado lógico en lugar de físico
      await this.person.update({
        where: { person_id: id },
        data: { is_active: false },
      });
      return {
        message: `${this.entityName} con ID ${id} desactivada correctamente (borrado lógico).`,
        deleted: true,
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error no manejado después de handlePrismaError',
      );
    }
  }

  async cancelSubscription(
    personId: number,
    subscriptionId: number,
    cancelDto: CancelSubscriptionDto,
  ): Promise<Prisma.customer_subscriptionGetPayload<{}>> {
    return this.$transaction(async (tx) => {
      const subscription = await tx.customer_subscription.findUnique({
        where: { subscription_id: subscriptionId },
        include: {
          subscription_cycle: {
            orderBy: { cycle_end: 'desc' },
            take: 1,
          },
          subscription_plan: {
            include: {
              subscription_plan_product: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!subscription) {
        throw new NotFoundException(
          `Suscripción con ID ${subscriptionId} no encontrada.`,
        );
      }
      if (subscription.customer_id !== personId) {
        throw new ForbiddenException(
          `No tienes permiso para cancelar la suscripción ID ${subscriptionId} de otra persona.`,
        );
      }
      if (
        subscription.status === SubscriptionStatus.CANCELLED ||
        subscription.status === SubscriptionStatus.EXPIRED
      ) {
        throw new BadRequestException(
          'La suscripción ya está cancelada o expirada.',
        );
      }
      if (
        subscription.status !== SubscriptionStatus.ACTIVE &&
        subscription.status !== SubscriptionStatus.PAUSED
      ) {
        throw new BadRequestException(
          `La suscripción está en estado ${subscription.status} y no se puede cancelar desde este estado.`,
        );
      }

      // Usar la fecha de cancelación del DTO
      const cancellationDate = new Date(cancelDto.cancellation_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Asegurar que la fecha de cancelación no sea anterior a hoy
      const effectiveEndDate =
        cancellationDate < today ? today : cancellationDate;

      const updatedSubscription = await tx.customer_subscription.update({
        where: { subscription_id: subscriptionId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancellation_date: effectiveEndDate,
        },
      });

      await tx.order_header.updateMany({
        where: {
          subscription_id: subscriptionId,
          scheduled_delivery_date: { gt: effectiveEndDate },
          status: {
            in: [
              PrismaOrderStatus.PENDING,
              PrismaOrderStatus.CONFIRMED,
              PrismaOrderStatus.IN_PREPARATION,
              PrismaOrderStatus.READY_FOR_DELIVERY,
              PrismaOrderStatus.IN_DELIVERY,
            ],
          },
        },
        data: {
          status: PrismaOrderStatus.CANCELLED,
        },
      });

      // Verificar si hay productos retornables en la suscripción
      const hasReturnableProducts =
        subscription.subscription_plan?.subscription_plan_product?.some(
          (item) => item.product?.is_returnable === true,
        );

      // Crear orden de cancelación solo si hay productos retornables
      if (hasReturnableProducts) {
        try {
          const scheduledCollectionDate = effectiveEndDate;

          await this.cancellationOrderService.createCancellationOrder(
            {
              subscription_id: subscriptionId,
              scheduled_collection_date: scheduledCollectionDate
                .toISOString()
                .split('T')[0],
              notes:
                `Orden de cancelación generada automáticamente para suscripción "${subscription.subscription_plan?.name || 'Plan sin nombre'}" (ID: ${subscriptionId}). ${cancelDto.notes || ''}`.trim(),
            },
            tx,
          );
        } catch (error) {
          // Log del error pero no fallar la cancelación de la suscripción
          console.error(
            `Error al crear orden de cancelación para suscripción ${subscriptionId}:`,
            error,
          );
        }
      }

      // Control de stock: devolver productos no retornables al inventario
      const nonReturnableProducts =
        subscription.subscription_plan?.subscription_plan_product?.filter(
          (item) => item.product && !item.product.is_returnable,
        ) || [];

      if (nonReturnableProducts.length > 0) {
        try {
          const returnMovementTypeId =
            await this.inventoryService.getMovementTypeIdByCode(
              BUSINESS_CONFIG.MOVEMENT_TYPES.INGRESO_DEVOLUCION_COMODATO,
              tx,
            );

          for (const planItem of nonReturnableProducts) {
            if (planItem.product_quantity > 0) {
              await this.inventoryService.createStockMovement(
                {
                  movement_type_id: returnMovementTypeId,
                  product_id: planItem.product_id,
                  quantity: planItem.product_quantity,
                  source_warehouse_id: null,
                  destination_warehouse_id:
                    BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
                  movement_date: new Date(),
                  remarks: `Devolución por cancelación de suscripción ${subscriptionId} - Producto no retornable: ${planItem.product?.description} (ID ${planItem.product_id})`,
                },
                tx,
              );
            }
          }
        } catch (error) {
          // Log del error pero no fallar la cancelación de la suscripción
          console.error(
            `Error al devolver stock de productos no retornables para suscripción ${subscriptionId}:`,
            error,
          );
        }
      }

      // Generar órdenes de recuperación y una sola orden de retiro para todos los comodatos activos
      try {

        const activeComodatos = await tx.comodato.findMany({
          where: {
            person_id: personId,
            subscription_id: subscriptionId,
            status: ComodatoStatus.ACTIVE,
          },
          include: {
            product: true,
          },
        });

        if (activeComodatos.length > 0) {
          // 1. Crear órdenes de recuperación individuales (como antes)
          for (const comodato of activeComodatos) {
            try {
              await this.recoveryOrderService.createRecoveryOrder(
                comodato.comodato_id,
                effectiveEndDate, // Usar la fecha de cancelación
                `Orden de recuperación generada automáticamente por cancelación de suscripción "${subscription.subscription_plan?.name || 'Plan sin nombre'}" (ID: ${subscriptionId})`,
                tx,
              );

            } catch (recoveryError) {
              console.error(
                `Error al crear orden de recuperación para comodato ${comodato.comodato_id}:`,
                recoveryError,
              );
            }
          }

          // 2. Crear UNA SOLA orden de retiro con todos los productos
          const orderItems = activeComodatos.map((comodato) => ({
            product_id: comodato.product_id,
            quantity: comodato.quantity,
            unit_price: 0, // Sin precio para retiro
            subtotal: 0, // Sin subtotal para retiro
            notes: `Retiro de comodato ${comodato.comodato_id} - ${comodato.product.description} (Plan: "${subscription.subscription_plan?.name || 'Plan sin nombre'}")`,
          }));

          const withdrawalOrder = await tx.order_header.create({
            data: {
              customer_id: personId,
              sale_channel_id: 1, // Canal por defecto
              order_date: new Date(),
              scheduled_delivery_date: effectiveEndDate, // Usar la fecha de cancelación del DTO
              total_amount: 0, // Sin costo para retiro
              paid_amount: 0, // Sin pago para retiro
              order_type: 'HYBRID', // Tipo de orden híbrida como solicitado
              status: 'PENDING', // Estado pendiente
              notes:
                `Pedido de retiro de comodatos por cancelación de suscripción "${subscription.subscription_plan?.name || 'Plan sin nombre'}" (ID: ${subscriptionId}). ${cancelDto.notes || ''}`.trim(),
              subscription_id: subscriptionId, // Asociar con la suscripción cancelada
              // Crear todos los items de orden en una sola transacción
              order_item: {
                create: orderItems,
              },
            },
          });

        }
      } catch (error) {
        console.error(
          `Error al buscar comodatos activos para suscripción ${subscriptionId}:`,
          error,
        );
        // No fallar la cancelación de la suscripción por este error
      }

      return updatedSubscription;
    });
  }

  async changeSubscriptionPlan(
    personId: number,
    dto: ChangeSubscriptionPlanDto,
  ): Promise<Prisma.customer_subscriptionGetPayload<{}>> {
    const newSubscription = await this.$transaction(async (tx) => {
      const currentSubscription = await tx.customer_subscription.findUnique({
        where: { subscription_id: dto.current_subscription_id },
        include: {
          subscription_cycle: { orderBy: { cycle_end: 'desc' }, take: 1 },
        },
      });

      if (!currentSubscription) {
        throw new NotFoundException(
          `Suscripción actual con ID ${dto.current_subscription_id} no encontrada.`,
        );
      }
      if (currentSubscription.customer_id !== personId) {
        throw new ForbiddenException(
          'No tienes permiso para modificar esta suscripción.',
        );
      }
      if (
        currentSubscription.status !== SubscriptionStatus.ACTIVE &&
        currentSubscription.status !== SubscriptionStatus.PAUSED
      ) {
        throw new BadRequestException(
          `La suscripción actual está en estado ${currentSubscription.status} y no se puede cambiar. Solo se pueden cambiar suscripciones ACTIVAS o PAUSADAS.`,
        );
      }

      const newPlan = await tx.subscription_plan.findUnique({
        where: { subscription_plan_id: dto.new_plan_id },
        include: {
          subscription_plan_product: true,
        },
      });
      if (!newPlan) {
        throw new NotFoundException(
          `Nuevo plan de suscripción con ID ${dto.new_plan_id} no encontrado.`,
        );
      }
      if (currentSubscription.subscription_plan_id === dto.new_plan_id) {
        throw new BadRequestException(
          'La suscripción actual ya tiene el plan seleccionado.',
        );
      }

      let oldSubscriptionEndDate =
        currentSubscription.subscription_cycle?.[0]?.cycle_end || new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (oldSubscriptionEndDate < today) oldSubscriptionEndDate = today;

      const newSubscriptionStartDate = new Date(oldSubscriptionEndDate);
      newSubscriptionStartDate.setDate(oldSubscriptionEndDate.getDate() + 1);
      newSubscriptionStartDate.setHours(0, 0, 0, 0);

      await tx.customer_subscription.update({
        where: { subscription_id: dto.current_subscription_id },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancellation_date: oldSubscriptionEndDate,
          notes:
            `${currentSubscription.notes || ''} - Reemplazada por plan ${dto.new_plan_id} el ${new Date().toISOString()}`.trim(),
        },
      });

      await tx.order_header.updateMany({
        where: {
          subscription_id: dto.current_subscription_id,
          scheduled_delivery_date: { gt: oldSubscriptionEndDate },
          status: {
            in: [
              PrismaOrderStatus.PENDING,
              PrismaOrderStatus.CONFIRMED,
              PrismaOrderStatus.IN_PREPARATION,
              PrismaOrderStatus.READY_FOR_DELIVERY,
              PrismaOrderStatus.IN_DELIVERY,
            ],
          },
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

      // Verificar y actualizar el tipo de cliente si es INDIVIDUAL
      const customer = await tx.person.findUnique({
        where: { person_id: personId },
        select: { type: true },
      });

      if (customer && customer.type === PrismaPersonType.INDIVIDUAL) {
        // Actualizar el tipo de cliente de INDIVIDUAL a PLAN
        await tx.person.update({
          where: { person_id: personId },
          data: { type: PrismaPersonType.PLAN },
        });

        // Actualizar el tipo de plan de suscripción a PLAN (si no lo está ya)
        if (newPlan.type !== PrismaPersonType.PLAN) {
          await tx.subscription_plan.update({
            where: { subscription_plan_id: dto.new_plan_id },
            data: { type: PrismaPersonType.PLAN },
          });
        }
      }

      const firstCycleStartDate = new Date(newSubscriptionStartDate);
      const firstCycleEndDate = new Date(firstCycleStartDate);
      firstCycleEndDate.setMonth(firstCycleStartDate.getMonth() + 1);
      firstCycleEndDate.setDate(firstCycleStartDate.getDate() - 1);
      firstCycleEndDate.setHours(23, 59, 59, 999);

      const newCycle = await tx.subscription_cycle.create({
        data: {
          subscription_id: newSubscription.subscription_id,
          cycle_number: 1,
          cycle_start: firstCycleStartDate,
          cycle_end: firstCycleEndDate,
          total_amount: 0, // Se calculará después
          payment_due_date: new Date(
            firstCycleEndDate.getTime() + 10 * 24 * 60 * 60 * 1000,
          ), // 10 días después del final del ciclo
          notes: 'Primer ciclo post cambio de plan.',
        },
      });

      // Crear los detalles del ciclo basados en el nuevo plan
      for (const planProduct of newPlan.subscription_plan_product) {
        await tx.subscription_cycle_detail.create({
          data: {
            cycle_id: newCycle.cycle_id,
            product_id: planProduct.product_id,
            planned_quantity: planProduct.product_quantity,
            delivered_quantity: 0,
            remaining_balance: planProduct.product_quantity,
          },
        });
      }

      return newSubscription;
    });

    // Calcular el total_amount del ciclo después de la transacción
    try {
      const createdCycle = await this.subscription_cycle.findFirst({
        where: {
          subscription_id: newSubscription.subscription_id,
          cycle_number: 1,
        },
      });

      if (createdCycle) {
        await this.cycleCalculatorService.calculateAndUpdateCycleAmount(
          createdCycle.cycle_id,
        );
      }
    } catch (error) {
      console.error(
        `❌ Error calculando total para ciclo de cambio de plan:`,
        error,
      );
    }

    return newSubscription;
  }

  async cancelContract(
    personId: number,
    contractId: number,
  ): Promise<Prisma.client_contractGetPayload<{}>> {
    return this.$transaction(async (tx) => {
      const contract = await tx.client_contract.findUnique({
        where: { contract_id: contractId },
      });

      if (!contract) {
        throw new NotFoundException(
          `Contrato con ID ${contractId} no encontrado.`,
        );
      }
      if (contract.person_id !== personId) {
        throw new ForbiddenException(
          'No tienes permiso para cancelar este contrato.',
        );
      }
      if (
        contract.status === ContractStatus.CANCELLED ||
        contract.status === ContractStatus.EXPIRED
      ) {
        throw new BadRequestException(
          'El contrato ya está cancelado o expirado.',
        );
      }
      if (
        contract.status !== ContractStatus.ACTIVE &&
        contract.status !== ContractStatus.PENDING_ACTIVATION
      ) {
        throw new BadRequestException(
          `El contrato está en estado ${contract.status} y no se puede cancelar desde este estado.`,
        );
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
            in: [
              PrismaOrderStatus.PENDING,
              PrismaOrderStatus.CONFIRMED,
              PrismaOrderStatus.IN_PREPARATION,
              PrismaOrderStatus.READY_FOR_DELIVERY,
              PrismaOrderStatus.IN_DELIVERY,
            ],
          },
        },
        data: {
          status: PrismaOrderStatus.CANCELLED,
        },
      });
      return updatedContract;
    });
  }

  async changeContractPriceList(
    personId: number,
    dto: ChangeContractPriceListDto,
  ): Promise<Prisma.client_contractGetPayload<{}>> {
    return this.$transaction(async (tx) => {
      const currentContract = await tx.client_contract.findUnique({
        where: { contract_id: dto.current_contract_id },
      });

      if (!currentContract) {
        throw new NotFoundException(
          `Contrato actual con ID ${dto.current_contract_id} no encontrado.`,
        );
      }
      if (currentContract.person_id !== personId) {
        throw new ForbiddenException(
          'No tienes permiso para modificar este contrato.',
        );
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
        throw new NotFoundException(
          `Nueva lista de precios con ID ${dto.new_price_list_id} no encontrada.`,
        );
      }
      if (currentContract.price_list_id === dto.new_price_list_id) {
        throw new BadRequestException(
          'El contrato actual ya utiliza esta lista de precios.',
        );
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
          notes:
            `${currentContract.notes || ''} - Reemplazado por lista de precios ${dto.new_price_list_id} el ${new Date().toISOString()}`.trim(),
        },
      });

      await tx.order_header.updateMany({
        where: {
          contract_id: dto.current_contract_id,
          scheduled_delivery_date: { gt: oldContractEffectiveEndDate },
          status: {
            in: [
              PrismaOrderStatus.PENDING,
              PrismaOrderStatus.CONFIRMED,
              PrismaOrderStatus.IN_PREPARATION,
              PrismaOrderStatus.READY_FOR_DELIVERY,
              PrismaOrderStatus.IN_DELIVERY,
            ],
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

  private async getLoanedProductsDetail(
    personId: number,
  ): Promise<LoanedProductDetailDto[]> {
    // Buscar todos los pedidos del cliente que estén en estados donde los productos ya fueron entregados
    const orders = await this.order_header.findMany({
      where: {
        customer_id: personId,
        status: {
          in: [
            PrismaOrderStatus.IN_DELIVERY,
            PrismaOrderStatus.DELIVERED,
            PrismaOrderStatus.REFUNDED,
          ],
        },
      },
      include: {
        order_item: {
          where: {
            product: {
              is_returnable: true,
            },
          },
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        order_date: 'desc',
      },
    });

    const loanedProductsDetail: LoanedProductDetailDto[] = [];

    for (const order of orders) {
      for (const item of order.order_item) {
        const delivered = item.delivered_quantity ?? 0;
        const returned = item.returned_quantity ?? 0;
        const netLoanedForItem = delivered - returned;

        // Solo considerar productos que realmente fueron entregados
        if (delivered > 0 && netLoanedForItem > 0) {
          loanedProductsDetail.push({
            product_id: item.product_id,
            description: item.product.description,
            loaned_quantity: netLoanedForItem,
            acquisition_date: order.order_date.toISOString().split('T')[0], // Solo la fecha
            order_id: order.order_id,
            order_status: order.status,
          });
        }
      }
    }

    return loanedProductsDetail;
  }

  async getPublicLoanedProductsDetailByPerson(
    personId: number,
  ): Promise<LoanedProductDetailDto[]> {
    await this.findPersonById(personId);
    return this.getLoanedProductsDetail(personId);
  }
  // Métodos de Comodato
  private mapToComodatoResponseDto(
    comodatoEntity: comodato & {
      person?: {
        person_id: number;
        name: string | null;
        phone: string;
        address: string | null;
        zone?: {
          zone_id: number;
          name: string;
        } | null;
        customer_subscription?: (customer_subscription & {
          subscription_plan: subscription_plan | null;
        })[];
      };
      product?: {
        product_id: number;
        description: string;
      };
    },
  ): ComodatoResponseDto {
    const firstSubscription = comodatoEntity.person?.customer_subscription?.[0];

    return {
      comodato_id: comodatoEntity.comodato_id,
      person_id: comodatoEntity.person_id,
      product_id: comodatoEntity.product_id,
      quantity: comodatoEntity.quantity,
      max_quantity: comodatoEntity.max_quantity || undefined,
      delivery_date: comodatoEntity.delivery_date,
      expected_return_date: comodatoEntity.expected_return_date || undefined,
      actual_return_date: comodatoEntity.return_date || undefined,
      status: comodatoEntity.status,
      notes: comodatoEntity.notes || undefined,
      deposit_amount: comodatoEntity.deposit_amount
        ? Number(comodatoEntity.deposit_amount)
        : undefined,
      monthly_fee: comodatoEntity.monthly_fee
        ? Number(comodatoEntity.monthly_fee)
        : undefined,
      article_description: comodatoEntity.article_description || undefined,
      brand: comodatoEntity.brand || undefined,
      model: comodatoEntity.model || undefined,
      contract_image_path: buildImageUrl(
        comodatoEntity.contract_image_path,
        'contracts',
      ),
      is_active: comodatoEntity.is_active,
      created_at: comodatoEntity.created_at,
      updated_at: comodatoEntity.updated_at,
      person: comodatoEntity.person
        ? {
            person_id: comodatoEntity.person.person_id,
            name: comodatoEntity.person.name || '',
            phone: comodatoEntity.person.phone,
            address: comodatoEntity.person.address || undefined,
            zone: comodatoEntity.person.zone || undefined,
          }
        : undefined,
      product: comodatoEntity.product
        ? {
            product_id: comodatoEntity.product.product_id,
            name: comodatoEntity.product.description,
            description: comodatoEntity.product.description,
          }
        : undefined,
      subscription: firstSubscription
        ? {
            subscription_id: firstSubscription.subscription_id,
            name: firstSubscription.subscription_plan?.name || '',
          }
        : undefined,
    };
  }

  async createComodato(dto: CreateComodatoDto): Promise<ComodatoResponseDto> {
    try {
      // Verificar que la persona existe y está activa
      const person = await this.person.findUnique({
        where: {
          person_id: dto.person_id,
          is_active: true, // Solo permitir comodatos para personas activas
        },
      });
      if (!person) {
        throw new NotFoundException(
          `Persona con ID ${dto.person_id} no encontrada`,
        );
      }

      // Verificar que el producto existe
      const product = await this.product.findUnique({
        where: { product_id: dto.product_id },
      });
      if (!product) {
        throw new NotFoundException(
          `Producto con ID ${dto.product_id} no encontrado`,
        );
      }

      // Verificar que el producto sea retornable
      if (!product.is_returnable) {
        throw new BadRequestException(
          `No se puede crear comodato para ${product.description} porque no es un producto retornable`,
        );
      }

      // Verificar si el cliente posee bidones propios para productos retornables
      if (person.owns_returnable_containers && product.is_returnable) {
        throw new BadRequestException(
          `No se puede crear comodato para ${product.description} porque el cliente posee bidones retornables propios`,
        );
      }

      const comodato = await this.comodato.create({
        data: {
          person_id: dto.person_id,
          product_id: dto.product_id,
          subscription_id: dto.subscription_id || null, // ← Agregar subscription_id
          quantity: dto.quantity,
          max_quantity: dto.max_quantity || null, // ← Cantidad máxima permitida
          delivery_date: new Date(dto.delivery_date),
          expected_return_date: dto.expected_return_date
            ? new Date(dto.expected_return_date)
            : null,
          status: dto.status,
          notes: dto.notes,
          deposit_amount: dto.deposit_amount,
          monthly_fee: dto.monthly_fee,
          article_description: dto.article_description,
          brand: dto.brand,
          model: dto.model,
          contract_image_path: dto.contract_image_path,
        },
        include: {
          person: {
            select: {
              person_id: true,
              name: true,
              phone: true,
              address: true,
              zone: {
                select: {
                  zone_id: true,
                  name: true,
                },
              },
              customer_subscription: {
                where: {
                  OR: [{ status: 'ACTIVE' }, { status: 'CANCELLED' }],
                },
                include: {
                  subscription_plan: true,
                },
                orderBy: {
                  start_date: 'desc',
                },
                take: 1,
              },
            },
          },
          product: {
            select: {
              product_id: true,
              description: true,
            },
          },
        },
      });

      return this.mapToComodatoResponseDto(comodato);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw handlePrismaError(error, this.entityName);
    }
  }

  async getComodatosByPerson(
    personId: number,
    filters: FilterComodatosDto,
  ): Promise<ComodatoResponseDto[]> {
    try {
      // Verificar que la persona existe y está activa
      const person = await this.person.findUnique({
        where: {
          person_id: personId,
          is_active: true, // Solo buscar comodatos de personas activas
        },
      });
      if (!person) {
        throw new NotFoundException(`Persona con ID ${personId} no encontrada`);
      }

      const whereConditions: Prisma.comodatoWhereInput = {
        person_id: personId,
      };

      // Aplicar filtros
      if (filters.product_id) {
        whereConditions.product_id = filters.product_id;
      }

      if (filters.status) {
        whereConditions.status = filters.status;
      }

      if (filters.delivery_date_from || filters.delivery_date_to) {
        whereConditions.delivery_date = {};
        if (filters.delivery_date_from) {
          whereConditions.delivery_date.gte = new Date(
            filters.delivery_date_from,
          );
        }
        if (filters.delivery_date_to) {
          whereConditions.delivery_date.lte = new Date(
            filters.delivery_date_to,
          );
        }
      }

      // Implementar paginación
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const comodatos = await this.comodato.findMany({
        where: whereConditions,
        include: {
          person: {
            select: {
              person_id: true,
              name: true,
              phone: true,
              address: true,
              zone: {
                select: {
                  zone_id: true,
                  name: true,
                },
              },
              customer_subscription: {
                where: {
                  OR: [{ status: 'ACTIVE' }, { status: 'CANCELLED' }],
                },
                include: {
                  subscription_plan: true,
                },
                orderBy: {
                  start_date: 'desc',
                },
                take: 1,
              },
            },
          },
          product: {
            select: {
              product_id: true,
              description: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: skip,
        take: limit,
      });

      return comodatos.map((comodato) =>
        this.mapToComodatoResponseDto(comodato),
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw handlePrismaError(error, this.entityName);
    }
  }

  async getAllComodatos(
    filters: FilterComodatosDto,
  ): Promise<ComodatoResponseDto[]> {
    try {
      const whereConditions: Prisma.comodatoWhereInput = {};

      // Aplicar filtros
      if (filters.person_id) {
        whereConditions.person_id = filters.person_id;
      }

      if (filters.product_id) {
        whereConditions.product_id = filters.product_id;
      }

      if (filters.status) {
        whereConditions.status = filters.status;
      }

      // Construir filtros para person de manera correcta
      const personFilters: any = {
        is_active: true, // Solo mostrar comodatos de personas activas
      };
      if (filters.zone_id) {
        personFilters.zone_id = filters.zone_id;
      }
      if (filters.customer_name) {
        personFilters.name = {
          contains: filters.customer_name,
          mode: 'insensitive',
        };
      }
      // Siempre aplicar el filtro de persona (al menos is_active)
      whereConditions.person = personFilters;

      if (filters.product_name) {
        whereConditions.product = {
          description: {
            contains: filters.product_name,
            mode: 'insensitive',
          },
        };
      }

      if (filters.search) {
        whereConditions.OR = [
          {
            person: {
              name: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          },
          {
            product: {
              description: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          },
          {
            notes: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
        ];
      }

      if (filters.delivery_date_from || filters.delivery_date_to) {
        whereConditions.delivery_date = {};
        if (filters.delivery_date_from) {
          whereConditions.delivery_date.gte = new Date(
            filters.delivery_date_from,
          );
        }
        if (filters.delivery_date_to) {
          whereConditions.delivery_date.lte = new Date(
            filters.delivery_date_to,
          );
        }
      }

      if (
        filters.expected_return_date_from ||
        filters.expected_return_date_to
      ) {
        whereConditions.expected_return_date = {};
        if (filters.expected_return_date_from) {
          whereConditions.expected_return_date.gte = new Date(
            filters.expected_return_date_from,
          );
        }
        if (filters.expected_return_date_to) {
          whereConditions.expected_return_date.lte = new Date(
            filters.expected_return_date_to,
          );
        }
      }

      if (filters.actual_return_date_from || filters.actual_return_date_to) {
        whereConditions.return_date = {};
        if (filters.actual_return_date_from) {
          whereConditions.return_date.gte = new Date(
            filters.actual_return_date_from,
          );
        }
        if (filters.actual_return_date_to) {
          whereConditions.return_date.lte = new Date(
            filters.actual_return_date_to,
          );
        }
      }

      const comodatos = await this.comodato.findMany({
        where: whereConditions,
        include: {
          person: {
            include: {
              zone: true,
              customer_subscription: {
                where: {
                  status: {
                    in: [
                      SubscriptionStatus.ACTIVE,
                      SubscriptionStatus.CANCELLED,
                    ],
                  },
                },
                include: {
                  subscription_plan: true,
                },
                orderBy: {
                  start_date: 'desc',
                },
                take: 1,
              },
            },
          },
          product: true,
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      return comodatos.map((comodato) =>
        this.mapToComodatoResponseDto(comodato),
      );
    } catch (error) {
      throw handlePrismaError(error, this.entityName);
    }
  }

  async getComodatoById(
    personId: number,
    comodatoId: number,
  ): Promise<ComodatoResponseDto> {
    try {
      const comodato = await this.comodato.findFirst({
        where: {
          comodato_id: comodatoId,
          person_id: personId,
          person: {
            is_active: true, // Solo buscar comodatos de personas activas
          },
        },
        include: {
          person: {
            select: {
              person_id: true,
              name: true,
              phone: true,
              address: true,
              zone: {
                select: {
                  zone_id: true,
                  name: true,
                },
              },
              customer_subscription: {
                where: {
                  OR: [{ status: 'ACTIVE' }, { status: 'CANCELLED' }],
                },
                include: {
                  subscription_plan: true,
                },
                orderBy: {
                  start_date: 'desc',
                },
                take: 1,
              },
            },
          },
          product: {
            select: {
              product_id: true,
              description: true,
            },
          },
        },
      });

      if (!comodato) {
        throw new NotFoundException(
          `Comodato con ID ${comodatoId} no encontrado para la persona ${personId}`,
        );
      }

      return this.mapToComodatoResponseDto(comodato);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw handlePrismaError(error, this.entityName);
    }
  }

  async updateComodato(
    personId: number,
    comodatoId: number,
    dto: UpdateComodatoDto,
  ): Promise<ComodatoResponseDto> {
    try {
      // Verificar que el comodato existe y pertenece a una persona activa
      const existingComodato = await this.comodato.findFirst({
        where: {
          comodato_id: comodatoId,
          person_id: personId,
          person: {
            is_active: true, // Solo permitir actualizar comodatos de personas activas
          },
        },
      });

      if (!existingComodato) {
        throw new NotFoundException(
          `Comodato con ID ${comodatoId} no encontrado para la persona ${personId}`,
        );
      }

      const updateData: Prisma.comodatoUpdateInput = {};

      if (dto.product_id !== undefined) {
        // Verificar que el nuevo producto existe
        const product = await this.product.findUnique({
          where: { product_id: dto.product_id },
        });

        if (!product) {
          throw new NotFoundException(
            `Producto con ID ${dto.product_id} no encontrado`,
          );
        }

        updateData.product = {
          connect: { product_id: dto.product_id },
        };
      }

      if (dto.quantity !== undefined) {
        updateData.quantity = dto.quantity;
      }

      if (dto.delivery_date !== undefined) {
        updateData.delivery_date = new Date(dto.delivery_date);
      }

      if (dto.expected_return_date !== undefined) {
        updateData.expected_return_date = dto.expected_return_date
          ? new Date(dto.expected_return_date)
          : null;
      }

      if (dto.actual_return_date !== undefined) {
        updateData.return_date = dto.actual_return_date
          ? new Date(dto.actual_return_date)
          : null;
      }

      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }

      if (dto.notes !== undefined) {
        updateData.notes = dto.notes;
      }

      if (dto.deposit_amount !== undefined) {
        updateData.deposit_amount = dto.deposit_amount;
      }

      if (dto.monthly_fee !== undefined) {
        updateData.monthly_fee = dto.monthly_fee;
      }

      if (dto.article_description !== undefined) {
        updateData.article_description = dto.article_description;
      }

      if (dto.brand !== undefined) {
        updateData.brand = dto.brand;
      }

      if (dto.model !== undefined) {
        updateData.model = dto.model;
      }

      if (dto.contract_image_path !== undefined) {
        updateData.contract_image_path = dto.contract_image_path;
      }

      const updatedComodato = await this.comodato.update({
        where: {
          comodato_id: comodatoId,
        },
        data: updateData,
        include: {
          person: {
            select: {
              person_id: true,
              name: true,
              phone: true,
              address: true,
              zone: {
                select: {
                  zone_id: true,
                  name: true,
                },
              },
              customer_subscription: {
                where: {
                  OR: [{ status: 'ACTIVE' }, { status: 'CANCELLED' }],
                },
                include: {
                  subscription_plan: true,
                },
                orderBy: {
                  start_date: 'desc',
                },
                take: 1,
              },
            },
          },
          product: {
            select: {
              product_id: true,
              description: true,
            },
          },
        },
      });

      return this.mapToComodatoResponseDto(updatedComodato);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw handlePrismaError(error, this.entityName);
    }
  }

  async deleteComodato(
    personId: number,
    comodatoId: number,
  ): Promise<{ message: string; deleted: boolean }> {
    try {
      // Verificar que el comodato existe y pertenece a la persona
      const existingComodato = await this.comodato.findFirst({
        where: {
          comodato_id: comodatoId,
          person_id: personId,
        },
      });

      if (!existingComodato) {
        throw new NotFoundException(
          `Comodato con ID ${comodatoId} no encontrado para la persona ${personId}`,
        );
      }

      // Soft delete: cambiar is_active a false en lugar de eliminar físicamente
      await this.comodato.update({
        where: {
          comodato_id: comodatoId,
        },
        data: { is_active: false },
      });

      return {
        message: 'Comodato desactivado exitosamente',
        deleted: true,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw handlePrismaError(error, this.entityName);
    }
  }

  async createSubscriptionWithComodato(
    dto: CreateSubscriptionWithComodatoDto,
  ): Promise<{ subscription: any; comodato: ComodatoResponseDto }> {
    try {
      // Verificar que la persona existe y está activa
      const person = await this.person.findUnique({
        where: {
          person_id: dto.customer_id,
          is_active: true,
        },
      });

      if (!person) {
        throw new NotFoundException(
          `Persona con ID ${dto.customer_id} no encontrada`,
        );
      }

      // Verificar que el producto para el comodato existe
      if (dto.comodato_product_id) {
        const product = await this.product.findUnique({
          where: { product_id: dto.comodato_product_id },
        });

        if (!product) {
          throw new NotFoundException(
            `Producto con ID ${dto.comodato_product_id} no encontrado`,
          );
        }
      }

      // Crear el DTO para la suscripción
      const subscriptionDto: CreateCustomerSubscriptionDto = {
        customer_id: dto.customer_id,
        subscription_plan_id: dto.subscription_plan_id,
        start_date: dto.start_date,
        collection_day: dto.collection_day,
        payment_mode: dto.payment_mode,
        payment_due_day: dto.payment_due_day,
        status: dto.status,
        notes: dto.notes,
        delivery_preferences: dto.delivery_preferences,
      };

      // Crear la suscripción usando el servicio de suscripciones
      const subscription =
        await this.customerSubscriptionService.create(subscriptionDto);

      // Crear el comodato si se proporcionaron los datos
      let comodato: ComodatoResponseDto | null = null;
      if (dto.comodato_product_id) {
        // Verificar si ya existe un comodato activo para este producto y suscripción específica
        const existingComodato = await this.comodato.findFirst({
          where: {
            person_id: dto.customer_id,
            product_id: dto.comodato_product_id,
            subscription_id: subscription.subscription_id,
            status: ComodatoStatus.ACTIVE,
            is_active: true,
          },
          include: {
            product: {
              select: {
                description: true,
              },
            },
          },
        });

        if (existingComodato) {
          throw new ConflictException(
            `El cliente ya tiene un comodato activo para el producto ${existingComodato.product?.description} (ID: ${existingComodato.comodato_id}) en esta suscripción. No se puede crear un comodato duplicado para la misma suscripción.`,
          );
        }

        const otherComodatos = await this.comodato.findMany({
          where: {
            person_id: dto.customer_id,
            product_id: dto.comodato_product_id,
            status: ComodatoStatus.ACTIVE,
            is_active: true,
            subscription_id: { not: subscription.subscription_id },
          },
        });

        if (otherComodatos.length > 0) {
        }

        const comodatoDto: CreateComodatoDto = {
          person_id: dto.customer_id,
          product_id: dto.comodato_product_id,
          subscription_id: subscription.subscription_id, // ← Agregar subscription_id
          quantity: 0, // ← Inicializar con 0 items - se incrementará con cada entrega
          max_quantity: dto.comodato_quantity || 1, // ← Cantidad máxima según la suscripción
          delivery_date:
            dto.comodato_delivery_date ||
            new Date().toISOString().split('T')[0],
          expected_return_date: dto.comodato_expected_return_date,
          status: dto.comodato_status || ComodatoStatus.ACTIVE,
          notes: dto.comodato_notes
            ? `${dto.comodato_notes} - Suscripción ID: ${subscription.subscription_id} - Cantidad máxima: ${dto.comodato_quantity || 1}`
            : `Comodato creado para suscripción ID: ${subscription.subscription_id} - Cantidad máxima: ${dto.comodato_quantity || 1}`,
          deposit_amount: dto.comodato_deposit_amount,
          monthly_fee: dto.comodato_monthly_fee,
          article_description: dto.comodato_article_description,
          brand: dto.comodato_brand,
          model: dto.comodato_model,
          contract_image_path: dto.comodato_contract_image_path,
        };

        comodato = await this.createComodato(comodatoDto);
      }

      return {
        subscription,
        comodato: comodato,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (error instanceof PrismaClientKnownRequestError) {
        handlePrismaError(error, this.entityName);
      }
      throw new InternalServerErrorException(
        `Error al crear suscripción con comodato: ${error.message}`,
      );
    }
  }

  /**
   * Retira un comodato específico sin cancelar la suscripción
   * @param personId ID de la persona propietaria del comodato
   * @param dto Datos del retiro del comodato
   * @returns Información del retiro procesado
   */
  async withdrawComodato(
    personId: number,
    dto: WithdrawComodatoDto,
  ): Promise<WithdrawComodatoResponseDto> {
    try {
      return await this.$transaction(async (tx) => {
        // 1. Verificar que el comodato existe y pertenece a la persona
        const comodato = await tx.comodato.findFirst({
          where: {
            comodato_id: dto.comodato_id,
            person_id: personId,
            status: ComodatoStatus.ACTIVE,
          },
          include: {
            product: true,
            subscription: {
              include: {
                subscription_plan: true,
              },
            },
            person: true,
          },
        });

        if (!comodato) {
          throw new NotFoundException(
            `Comodato activo con ID ${dto.comodato_id} no encontrado para la persona ${personId}`,
          );
        }

        // 2. Verificar que la suscripción asociada sigue activa (si existe)
        if (
          comodato.subscription &&
          comodato.subscription.status !== SubscriptionStatus.ACTIVE
        ) {
          throw new BadRequestException(
            `No se puede retirar el comodato porque la suscripción asociada no está activa (Estado: ${comodato.subscription.status})`,
          );
        }

        // 3. Calcular fecha de retiro programada
        const scheduledDate = dto.scheduled_withdrawal_date
          ? new Date(dto.scheduled_withdrawal_date)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días por defecto

        // 4. Crear orden de recuperación si se solicita
        let recoveryOrderId: number | undefined;
        if (dto.create_recovery_order !== false) {
          try {
            const recoveryOrder =
              await this.recoveryOrderService.createRecoveryOrder(
                dto.comodato_id,
                scheduledDate,
                dto.withdrawal_reason ||
                  `Retiro independiente solicitado - ${dto.notes || 'Sin notas adicionales'}`,
                tx,
              );
            recoveryOrderId = recoveryOrder.recovery_order_id;
          } catch (recoveryError) {
            console.error(
              `Error al crear orden de recuperación para comodato ${dto.comodato_id}:`,
              recoveryError,
            );
            // No fallar el proceso si no se puede crear la orden de recuperación
          }
        }

        // 5. Crear orden de retiro
        const withdrawalOrder = await tx.order_header.create({
          data: {
            customer_id: personId,
            sale_channel_id: 1, // Canal por defecto
            order_date: new Date(),
            scheduled_delivery_date: scheduledDate,
            total_amount: 0, // Sin costo para retiro
            paid_amount: 0, // Sin pago para retiro
            order_type: 'ONE_OFF', // Tipo de orden única
            status: 'PENDING', // Estado pendiente
            notes:
              `Retiro independiente de comodato ${dto.comodato_id} - Producto: ${comodato.product.description} (Cantidad: ${comodato.quantity}). Motivo: ${dto.withdrawal_reason || 'No especificado'}. ${dto.notes || ''}`.trim(),
            subscription_id: comodato.subscription_id, // Asociar con la suscripción si existe
            // Crear item de orden para el retiro
            order_item: {
              create: {
                product_id: comodato.product_id,
                quantity: comodato.quantity,
                unit_price: 0, // Sin precio para retiro
                subtotal: 0, // Sin subtotal para retiro
                notes: `Retiro independiente de comodato ${dto.comodato_id} - ${comodato.product.description}`,
              },
            },
          },
        });

        // 6. Actualizar estado del comodato a "PENDING_WITHDRAWAL" (estado personalizado)
        // Nota: Si este estado no existe en el enum, se puede usar ACTIVE y agregar una nota
        const updatedComodato = await tx.comodato.update({
          where: { comodato_id: dto.comodato_id },
          data: {
            expected_return_date: scheduledDate,
            notes:
              `${comodato.notes || ''} | RETIRO PROGRAMADO: ${dto.withdrawal_reason || 'Retiro independiente'} - Fecha: ${scheduledDate.toISOString().split('T')[0]}`.trim(),
          },
        });

        // 7. Preparar respuesta
        const response: WithdrawComodatoResponseDto = {
          success: true,
          message: 'Retiro de comodato procesado exitosamente',
          comodato_id: dto.comodato_id,
          withdrawal_order_id: withdrawalOrder.order_id,
          recovery_order_id: recoveryOrderId,
          scheduled_withdrawal_date: scheduledDate,
          comodato_status: 'PENDING_WITHDRAWAL',
          product_info: {
            product_id: comodato.product_id,
            product_name: comodato.product.description,
            quantity: comodato.quantity,
          },
        };

        // 8. Agregar información de suscripción si existe
        if (comodato.subscription) {
          response.subscription_info = {
            subscription_id: comodato.subscription.subscription_id,
            subscription_status: comodato.subscription.status,
            plan_name:
              comodato.subscription.subscription_plan?.name ||
              'Plan sin nombre',
          };
        }

        return response;
      });
    } catch (error) {
      console.error(
        `Error al procesar retiro de comodato ${dto.comodato_id}:`,
        error,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      if (error instanceof PrismaClientKnownRequestError) {
        handlePrismaError(error, this.entityName);
      }

      throw new InternalServerErrorException(
        `Error al procesar retiro de comodato: ${error.message}`,
      );
    }
  }
}
