import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrigenPedido as DbOrigenPedido,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderStatus, OrderType } from '../common/constants/enums';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { OrderResponseDto } from '../orders/dto/order-response.dto';
import { PortalCreateOrderDto } from './dto/portal-create-order.dto';
import { PortalUpdateOrderDto } from './dto/portal-update-order.dto';
import { PortalFilterOrdersDto } from './dto/portal-filter-orders.dto';
import {
  PortalChangePasswordDto,
  PortalProfileResponseDto,
  PortalUpdateProfileDto,
} from './dto/portal-profile.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { BUSINESS_CONFIG } from '../common/config/business.config';
import {
  LoginServiceClient,
  SystemCode,
} from './services/login-service.client';
import {
  PortalCatalogPriceListDto,
  PortalCatalogResponseDto,
  PortalSubscriptionDto,
} from './dto/portal-catalog.dto';
import { formatBAYMD } from '../common/utils/date.utils';

const CATALOG_PRODUCT_SELECT = {
  product_id: true,
  description: true,
  volume_liters: true,
  is_returnable: true,
  image_url: true,
} satisfies Prisma.productSelect;

type CatalogProduct = Prisma.productGetPayload<{
  select: typeof CATALOG_PRODUCT_SELECT;
}>;

interface CustomerPriceEntry {
  product: CatalogProduct;
  unit_price: Decimal;
  price_list_id: number;
}

interface CustomerPricing {
  contract: { contract_id: number; price_list_id: number } | null;
  priceLists: PortalCatalogPriceListDto[];
  prices: Map<number, CustomerPriceEntry>;
}

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly loginServiceClient: LoginServiceClient,
  ) {}

  // ── Perfil ───────────────────────────────────────────────────────

  async getProfile(customerId: number): Promise<PortalProfileResponseDto> {
    const person = await this.prisma.person.findUnique({
      where: { person_id: customerId },
    });
    if (!person) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return this.toProfileResponse(person);
  }

  async updateProfile(
    customerId: number,
    dto: PortalUpdateProfileDto,
  ): Promise<PortalProfileResponseDto> {
    const current = await this.prisma.person.findUnique({
      where: { person_id: customerId },
    });
    if (!current) {
      throw new NotFoundException('Cliente no encontrado');
    }

    let newPhone = current.phone;
    if (dto.phone && dto.phone.trim() && dto.phone.trim() !== current.phone) {
      const conflict = await this.prisma.person.findFirst({
        where: { phone: dto.phone.trim(), NOT: { person_id: customerId } },
        select: { person_id: true },
      });
      if (conflict) {
        throw new ConflictException(
          'El teléfono ya está registrado por otro cliente',
        );
      }
      newPhone = dto.phone.trim();
    }

    const updated = await this.prisma.person.update({
      where: { person_id: customerId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.alias !== undefined ? { alias: dto.alias } : {}),
        ...(dto.tax_id !== undefined ? { tax_id: dto.tax_id } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.locality_id !== undefined
          ? { locality_id: dto.locality_id }
          : {}),
        ...(dto.zone_id !== undefined ? { zone_id: dto.zone_id } : {}),
        ...(dto.secondary_phone !== undefined
          ? { secondary_phone: dto.secondary_phone }
          : {}),
        ...(dto.additional_phones !== undefined
          ? { additional_phones: dto.additional_phones }
          : {}),
        ...(dto.phone && dto.phone.trim() ? { phone: dto.phone.trim() } : {}),
      },
    });

    if (newPhone !== current.phone) {
      await this.loginServiceClient.syncCredential({
        system: 'AGUAVIVA' as SystemCode,
        customerId: updated.person_id,
        phone: newPhone,
        password: 'TemporalChange#2026',
        isActive: true,
      });
      this.logger.warn(
        `Teléfono del cliente ${updated.person_id} actualizado. Se requiere restablecer la contraseña del portal.`,
      );
    }

    return this.toProfileResponse(updated);
  }

  async changePassword(
    customerId: number,
    dto: PortalChangePasswordDto,
  ): Promise<{ passwordChanged: boolean }> {
    const person: any = await this.prisma.person.findUnique({
      where: { person_id: customerId },
    });
    if (!person) {
      throw new NotFoundException('Cliente no encontrado');
    }
    if (!person.password_hash) {
      throw new BadRequestException(
        'El cliente aún no tiene contraseña asignada para el portal. Contacte a la empresa.',
      );
    }
    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.compare(
      dto.currentPassword,
      person.password_hash,
    );
    if (!valid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new ConflictException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }
    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.person.update({
      where: { person_id: customerId },
      data: { password_hash: newHash } as any,
    });
    await this.loginServiceClient.syncCredential({
      system: 'AGUAVIVA' as SystemCode,
      customerId,
      phone: person.phone,
      password: dto.newPassword,
      isActive: true,
    });
    return { passwordChanged: true };
  }

  // ── Catálogo ─────────────────────────────────────────────────────

  async getCatalog(customerId: number): Promise<PortalCatalogResponseDto> {
    const [pricing, subscriptions] = await Promise.all([
      this.resolveCustomerPricing(customerId),
      this.findActiveSubscriptions(customerId),
    ]);
    const products = [...pricing.prices.values()]
      .map((entry) => ({
        product_id: entry.product.product_id,
        description: entry.product.description.trim(),
        volume_liters: entry.product.volume_liters?.toFixed(2) ?? null,
        is_returnable: entry.product.is_returnable,
        image_url: entry.product.image_url ?? null,
        unit_price: entry.unit_price.toFixed(2),
        price_list_id: entry.price_list_id,
      }))
      .sort((a, b) => a.description.localeCompare(b.description, 'es'));

    return {
      contract_id: pricing.contract?.contract_id ?? null,
      price_lists: pricing.priceLists,
      products,
      subscriptions,
    };
  }

  // ── Pedidos ──────────────────────────────────────────────────────

  async createOrder(
    customerId: number,
    dto: PortalCreateOrderDto,
  ): Promise<OrderResponseDto> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Debe incluir al menos un ítem en el pedido',
      );
    }

    const pricing = await this.resolveCustomerPricing(customerId);
    const { contract } = pricing;
    const subscriptionId = await this.resolveSubscriptionForOrder(
      customerId,
      dto.subscription_id,
    );
    const items = this.priceItems(dto.items, pricing);
    // Con abono el total real lo calcula OrdersService según la cuota
    // disponible (lo cubierto va a $0); este es el total a precio de lista.
    const listTotal = items.reduce(
      (sum, item) =>
        sum.plus(
          pricing.prices.get(item.product_id).unit_price.mul(item.quantity),
        ),
      new Decimal(0),
    );

    let orderType = contract ? OrderType.CONTRACT_DELIVERY : OrderType.ONE_OFF;
    if (subscriptionId) orderType = OrderType.HYBRID;

    const orderDto: CreateOrderDto = {
      customer_id: customerId,
      sale_channel_id: 1,
      order_date: new Date().toISOString(),
      scheduled_delivery_date: dto.scheduled_delivery_date,
      delivery_time: dto.delivery_time,
      total_amount: listTotal.toString(),
      paid_amount: '0.00',
      order_type: orderType,
      status: OrderStatus.PENDING,
      notes: dto.notes,
      contract_id: contract?.contract_id,
      subscription_id: subscriptionId ?? undefined,
      items,
    };

    const created = await this.ordersService.create(orderDto, undefined, {
      origenPedido: DbOrigenPedido.PORTAL_CLIENTES,
    });
    return this.ordersService.findOne(created.order_id);
  }

  async updateOrder(
    customerId: number,
    orderId: number,
    dto: PortalUpdateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order_header.findUnique({
      where: { order_id: orderId },
    });
    if (!order || order.customer_id !== customerId) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new ForbiddenException(
        `Solo se pueden editar pedidos en estado PENDING. Estado actual: ${order.status}`,
      );
    }

    const { UpdateOrderDto } = await import('../orders/dto/update-order.dto');
    const updateDto = new UpdateOrderDto();
    if (dto.scheduled_delivery_date !== undefined) {
      updateDto.scheduled_delivery_date = dto.scheduled_delivery_date;
    }
    if (dto.delivery_time !== undefined)
      updateDto.delivery_time = dto.delivery_time;
    if (dto.notes !== undefined) updateDto.notes = dto.notes;
    if (dto.items_to_update_or_create || dto.items) {
      const pricing = await this.resolveCustomerPricing(customerId);
      if (dto.items_to_update_or_create) {
        updateDto.items_to_update_or_create = this.priceItems(
          dto.items_to_update_or_create,
          pricing,
        );
      }
      if (dto.items) {
        updateDto.items = this.priceItems(dto.items, pricing);
      }
    }
    if (dto.item_ids_to_delete) {
      updateDto.item_ids_to_delete = dto.item_ids_to_delete;
    }

    return this.ordersService.update(orderId, updateDto);
  }

  async removeOrder(
    customerId: number,
    orderId: number,
  ): Promise<{ message: string; deleted: boolean }> {
    const order = await this.prisma.order_header.findUnique({
      where: { order_id: orderId },
      select: { customer_id: true, status: true, is_active: true },
    });
    if (!order || order.customer_id !== customerId) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new ForbiddenException(
        `Solo se pueden eliminar pedidos en estado PENDING. Estado actual: ${order.status}`,
      );
    }
    await this.prisma.order_header.update({
      where: { order_id: orderId },
      data: { is_active: false },
    });
    return { message: 'Pedido eliminado', deleted: true };
  }

  async getOrderById(
    customerId: number,
    orderId: number,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order_header.findFirst({
      where: { order_id: orderId, customer_id: customerId },
    });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return this.ordersService.findOne(orderId);
  }

  async getOrderHistory(
    customerId: number,
    filters: PortalFilterOrdersDto,
  ): Promise<{
    data: OrderResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where: Prisma.order_headerWhereInput = {
      customer_id: customerId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.statuses && filters.statuses.length > 0
        ? { status: { in: filters.statuses as OrderStatus[] } }
        : {}),
      ...(filters.origen_pedido
        ? { origen_pedido: filters.origen_pedido }
        : {}),
      ...(filters.orderDateFrom || filters.orderDateTo
        ? {
            order_date: {
              ...(filters.orderDateFrom
                ? { gte: new Date(filters.orderDateFrom) }
                : {}),
              ...(filters.orderDateTo
                ? { lte: new Date(filters.orderDateTo) }
                : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { notes: { contains: filters.search, mode: 'insensitive' } },
              { order_id: { equals: parseInt(filters.search) || -1 } },
            ],
          }
        : {}),
    };

    const sortBy = filters.sortBy ?? 'order_date:desc';
    const orderByClause = parseSortByString(sortBy, [
      { order_date: 'desc' },
      { order_id: 'desc' },
    ]);
    const orderBy = (orderByClause ?? [
      { order_date: 'desc' },
      { order_id: 'desc' },
    ]) as Prisma.order_headerOrderByWithRelationInput[];

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order_header.count({ where }),
      this.prisma.order_header.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data: OrderResponseDto[] = [];
    for (const o of orders) {
      try {
        data.push(await this.ordersService.findOne(o.order_id));
      } catch (err) {
        this.logger.warn(
          `No se pudo mapear el pedido ${o.order_id}: ${(err as Error).message}`,
        );
      }
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  // ── Internos ─────────────────────────────────────────────────────

  private async resolveActiveContractForCustomer(customerId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.client_contract.findFirst({
      where: {
        person_id: customerId,
        status: { in: ['ACTIVE' as any] },
        start_date: { lte: today },
        OR: [{ end_date: null }, { end_date: { gte: today } }],
      },
      orderBy: [{ start_date: 'desc' }, { contract_id: 'desc' }],
    });
  }

  /**
   * Precios del cliente: los de la lista de su contrato vigente o, sin
   * contrato, los de la lista general. Lo usan el catálogo y la
   * creación/edición de pedidos, así el cliente paga lo que ve.
   */
  private async resolveCustomerPricing(
    customerId: number,
  ): Promise<CustomerPricing> {
    const contract = await this.resolveActiveContractForCustomer(customerId);
    const priceListId =
      contract?.price_list_id ?? BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;

    const [lists, items] = await Promise.all([
      this.prisma.price_list.findMany({
        where: { price_list_id: priceListId },
        select: { price_list_id: true, name: true },
      }),
      this.prisma.price_list_item.findMany({
        where: { price_list_id: priceListId, product: { is_active: true } },
        select: {
          price_list_id: true,
          unit_price: true,
          product: { select: CATALOG_PRODUCT_SELECT },
        },
      }),
    ]);

    const prices = new Map<number, CustomerPriceEntry>();
    for (const item of items) {
      if (prices.has(item.product.product_id)) continue;
      prices.set(item.product.product_id, {
        product: item.product,
        unit_price: new Decimal(item.unit_price),
        price_list_id: item.price_list_id,
      });
    }

    return {
      contract: contract
        ? {
            contract_id: contract.contract_id,
            price_list_id: contract.price_list_id,
          }
        : null,
      priceLists: lists,
      prices,
    };
  }

  /** Asigna a cada ítem la lista de precios del cliente; rechaza productos fuera de su catálogo. */
  private priceItems<T extends { product_id: number; quantity: number }>(
    items: T[],
    pricing: CustomerPricing,
  ): (T & { price_list_id: number })[] {
    return items.map((item) => {
      const entry = pricing.prices.get(item.product_id);
      if (!entry) {
        throw new BadRequestException(
          `El producto ${item.product_id} no está disponible para tu lista de precios.`,
        );
      }
      return { ...item, price_list_id: entry.price_list_id };
    });
  }

  /** Abonos activos del cliente con la cuota del ciclo vigente (solo lectura). */
  private async findActiveSubscriptions(
    customerId: number,
  ): Promise<PortalSubscriptionDto[]> {
    const today = new Date();
    const subscriptions = await this.prisma.customer_subscription.findMany({
      where: {
        customer_id: customerId,
        status: SubscriptionStatus.ACTIVE,
        is_active: true,
      },
      orderBy: { subscription_id: 'asc' },
      select: {
        subscription_id: true,
        subscription_plan: { select: { name: true } },
        subscription_cycle: {
          where: { cycle_start: { lte: today }, cycle_end: { gte: today } },
          orderBy: { cycle_start: 'desc' },
          take: 1,
          select: {
            cycle_start: true,
            cycle_end: true,
            subscription_cycle_detail: {
              orderBy: { product_id: 'asc' },
              select: {
                product_id: true,
                planned_quantity: true,
                delivered_quantity: true,
                remaining_balance: true,
                product: { select: { description: true } },
              },
            },
          },
        },
      },
    });

    return subscriptions.map((subscription) => {
      const cycle = subscription.subscription_cycle[0];
      return {
        subscription_id: subscription.subscription_id,
        plan_name: subscription.subscription_plan.name,
        cycle_start: cycle ? formatBAYMD(cycle.cycle_start) : null,
        cycle_end: cycle ? formatBAYMD(cycle.cycle_end) : null,
        quotas: (cycle?.subscription_cycle_detail ?? []).map((detail) => ({
          product_id: detail.product_id,
          description: detail.product.description.trim(),
          planned_quantity: detail.planned_quantity,
          delivered_quantity: detail.delivered_quantity,
          remaining_balance: detail.remaining_balance,
        })),
      };
    });
  }

  /**
   * Abono al que se descuenta un pedido: el indicado por el cliente (debe ser
   * suyo y estar activo) o, si no indica ninguno, su único abono activo.
   */
  private async resolveSubscriptionForOrder(
    customerId: number,
    requestedId?: number,
  ): Promise<number | null> {
    const active = await this.prisma.customer_subscription.findMany({
      where: {
        customer_id: customerId,
        status: SubscriptionStatus.ACTIVE,
        is_active: true,
      },
      select: { subscription_id: true },
    });
    const ids = active.map((row) => row.subscription_id);

    if (requestedId !== undefined) {
      if (!ids.includes(requestedId)) {
        throw new BadRequestException(
          `El abono ${requestedId} no está activo para este cliente.`,
        );
      }
      return requestedId;
    }
    if (ids.length > 1) {
      throw new BadRequestException(
        'Tenés más de un abono activo: indicá subscription_id para elegir a cuál se descuenta el pedido.',
      );
    }
    return ids[0] ?? null;
  }

  private toProfileResponse(person: any): PortalProfileResponseDto {
    return {
      person_id: person.person_id,
      phone: person.phone,
      name: person.name,
      alias: person.alias,
      tax_id: person.tax_id,
      address: person.address,
      secondary_phone: person.secondary_phone,
      additional_phones: person.additional_phones,
      locality_id: person.locality_id,
      zone_id: person.zone_id,
      type: person.type,
      is_active: person.is_active,
      owns_returnable_containers: person.owns_returnable_containers,
      has_portal_password: !!person.password_hash,
      registration_date: person.registration_date,
    };
  }
}
