import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderStatus, OrderType, OrigenPedido } from '../common/constants/enums';
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
import { LoginServiceClient, SystemCode } from './services/login-service.client';

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
        throw new ConflictException('El teléfono ya está registrado por otro cliente');
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
        ...(dto.locality_id !== undefined ? { locality_id: dto.locality_id } : {}),
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
    const valid = await bcrypt.compare(dto.currentPassword, person.password_hash);
    if (!valid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new ConflictException('La nueva contraseña debe ser diferente a la actual');
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

  // ── Pedidos ──────────────────────────────────────────────────────

  async createOrder(
    customerId: number,
    dto: PortalCreateOrderDto,
  ): Promise<OrderResponseDto> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Debe incluir al menos un ítem en el pedido');
    }

    const contract = await this.resolveActiveContractForCustomer(customerId);
    const { totalAmount, priceListMap } = await this.computeOrderPricing(
      dto.items,
      contract?.price_list_id ?? null,
    );

    const orderDto: CreateOrderDto = {
      customer_id: customerId,
      sale_channel_id: 1,
      order_date: dto.order_date ?? new Date().toISOString(),
      scheduled_delivery_date: dto.scheduled_delivery_date,
      delivery_time: dto.delivery_time,
      total_amount: totalAmount.toString(),
      paid_amount: '0.00',
      order_type: contract
        ? OrderType.CONTRACT_DELIVERY
        : OrderType.ONE_OFF,
      status: OrderStatus.PENDING,
      notes: dto.notes,
      contract_id: contract?.contract_id,
      items: dto.items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price_list_id: priceListMap.get(item.product_id),
        notes: item.notes,
      })),
    };

    const created = await this.ordersService.create(orderDto);

    await this.prisma.order_header.update({
      where: { order_id: created.order_id },
      data: { origen_pedido: OrigenPedido.PORTAL_CLIENTES } as any,
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
    if (dto.contract_id !== undefined) updateDto.contract_id = dto.contract_id;
    if (dto.scheduled_delivery_date !== undefined) {
      updateDto.scheduled_delivery_date = dto.scheduled_delivery_date;
    }
    if (dto.delivery_time !== undefined) updateDto.delivery_time = dto.delivery_time;
    if (dto.notes !== undefined) updateDto.notes = dto.notes;
    if (dto.items_to_update_or_create) {
      updateDto.items_to_update_or_create = dto.items_to_update_or_create;
    }
    if (dto.item_ids_to_delete) {
      updateDto.item_ids_to_delete = dto.item_ids_to_delete;
    }
    if (dto.items) {
      updateDto.items = dto.items;
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
      ...(filters.origen_pedido ? { origen_pedido: filters.origen_pedido } : {}),
      ...(filters.orderDateFrom || filters.orderDateTo
        ? {
            order_date: {
              ...(filters.orderDateFrom ? { gte: new Date(filters.orderDateFrom) } : {}),
              ...(filters.orderDateTo ? { lte: new Date(filters.orderDateTo) } : {}),
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
    const orderByClause = parseSortByString(
      sortBy,
      [{ order_date: 'desc' }, { order_id: 'desc' }],
    );
    const orderBy = (orderByClause ?? [{ order_date: 'desc' }, { order_id: 'desc' }]) as Prisma.order_headerOrderByWithRelationInput[];

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

  private async computeOrderPricing(
    items: { product_id: number; quantity: number; price_list_id?: number }[],
    contractPriceListId: number | null,
  ): Promise<{ totalAmount: Decimal; priceListMap: Map<number, number | undefined> }> {
    const priceListMap = new Map<number, number | undefined>();
    let total = new Decimal(0);

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { product_id: item.product_id },
      });
      if (!product) {
        throw new NotFoundException(`Producto ${item.product_id} no encontrado`);
      }

      let unitPrice: Decimal = new Decimal(product.price);
      let usedPriceListId: number | undefined = undefined;

      if (item.price_list_id) {
        const priceItem = await this.prisma.price_list_item.findFirst({
          where: { price_list_id: item.price_list_id, product_id: item.product_id },
        });
        if (!priceItem) {
          throw new BadRequestException(
            `El producto ${product.description} no está disponible en la lista de precios ${item.price_list_id}.`,
          );
        }
        unitPrice = new Decimal(priceItem.unit_price);
        usedPriceListId = item.price_list_id;
      } else if (contractPriceListId) {
        const priceItem = await this.prisma.price_list_item.findFirst({
          where: { price_list_id: contractPriceListId, product_id: item.product_id },
        });
        if (priceItem) {
          unitPrice = new Decimal(priceItem.unit_price);
          usedPriceListId = contractPriceListId;
        }
      } else {
        const standardItem = await this.prisma.price_list_item.findFirst({
          where: {
            price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
            product_id: item.product_id,
          },
        });
        if (standardItem) {
          unitPrice = new Decimal(standardItem.unit_price);
          usedPriceListId = BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID;
        }
      }

      total = total.plus(unitPrice.mul(item.quantity));
      priceListMap.set(item.product_id, usedPriceListId);
    }

    return { totalAmount: total, priceListMap };
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
