import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { LoginServiceClient } from './services/login-service.client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OrderStatus,
  OrigenPedido,
  OrderType,
} from '../common/constants/enums';
import { Decimal } from '@prisma/client/runtime/library';

describe('Portal (AguaViva) - e2e unit', () => {
  let app: INestApplication<App>;
  let prismaMock: any;
  let ordersServiceMock: any;
  let loginServiceClientMock: any;

  const fakePayload = {
    sub: 'client:1',
    clientId: 1,
    customerId: 99,
    system: 'AGUAVIVA',
    type: 'access' as const,
  };

  function signToken(payload = fakePayload) {
    const jwt = new JwtService({
      secret: 'test-secret',
      signOptions: {
        issuer: 'login-service-client-portal',
        audience: 'client-portal',
        expiresIn: '1h',
      },
      verifyOptions: {
        issuer: 'login-service-client-portal',
        audience: 'client-portal',
      },
    });
    return jwt.signAsync({ ...payload });
  }

  const mockProfile = {
    person_id: 99,
    phone: '3794987654',
    name: 'Cliente AguaViva',
    alias: null,
    tax_id: null,
    address: null,
    secondary_phone: null,
    additional_phones: null,
    locality_id: null,
    zone_id: null,
    type: 'INDIVIDUAL',
    is_active: true,
    owns_returnable_containers: false,
    password_hash: 'hashed',
    registration_date: new Date('2026-01-01'),
  };

  const mockOrder = {
    order_id: 200,
    customer_id: 99,
    order_date: new Date('2026-01-15'),
    total_amount: new Decimal(2000),
    paid_amount: new Decimal(0),
    status: OrderStatus.PENDING,
    order_type: OrderType.ONE_OFF,
    payment_status: 'PENDING',
    notes: null,
    items: [],
  };

  beforeEach(async () => {
    process.env.CLIENT_PORTAL_JWT_SECRET = 'test-secret';
    process.env.MODULE_SYSTEM_CODE = 'AGUAVIVA';

    prismaMock = {
      person: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      order_header: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      product: { findUnique: jest.fn() },
      price_list_item: { findFirst: jest.fn(), findMany: jest.fn() },
      price_list: { findMany: jest.fn() },
      client_contract: { findFirst: jest.fn() },
      customer_subscription: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(),
    };

    ordersServiceMock = {
      create: jest
        .fn()
        .mockImplementation(async (dto) => ({ ...mockOrder, ...dto })),
      update: jest
        .fn()
        .mockImplementation(async (id, dto) => ({ ...mockOrder, ...dto })),
      findOne: jest
        .fn()
        .mockImplementation(async (id) => ({ ...mockOrder, order_id: id })),
    };

    loginServiceClientMock = {
      syncCredential: jest.fn().mockResolvedValue({ id: 1 }),
      disableCredential: jest.fn().mockResolvedValue(true),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [
        PortalService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: new JwtService({}) },
        { provide: OrdersService, useValue: ordersServiceMock },
        { provide: LoginServiceClient, useValue: loginServiceClientMock },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              ({
                CLIENT_PORTAL_JWT_SECRET: 'test-secret',
                MODULE_SYSTEM_CODE: 'AGUAVIVA',
              })[k],
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /portal/me → 200 con perfil del cliente', async () => {
    prismaMock.person.findUnique.mockResolvedValue(mockProfile);
    const token = await signToken();
    const res = await request(app.getHttpServer())
      .get('/portal/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.person_id).toBe(99);
  });

  function mockGeneralPriceList() {
    prismaMock.client_contract.findFirst.mockResolvedValue(null);
    prismaMock.price_list.findMany.mockResolvedValue([
      { price_list_id: 1, name: 'Lista General' },
    ]);
    prismaMock.price_list_item.findMany.mockResolvedValue([
      {
        price_list_id: 1,
        unit_price: new Decimal(800),
        product: {
          product_id: 1,
          description: 'Bidón 20L ',
          volume_liters: new Decimal(20),
          is_returnable: true,
          image_url: null,
        },
      },
    ]);
  }

  async function postOrder(body: Record<string, unknown>, status: number) {
    const token = await signToken();
    return request(app.getHttpServer())
      .post('/portal/orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(status);
  }

  it('POST /portal/orders sin abono crea ONE_OFF con precios del servidor y origen PORTAL_CLIENTES', async () => {
    mockGeneralPriceList();

    const res = await postOrder(
      {
        contract_id: 5,
        items: [{ product_id: 1, quantity: 2, price_list_id: 9 }],
      },
      201,
    );

    expect(res.body.customer_id).toBe(99);
    const [orderDto, , options] = ordersServiceMock.create.mock.calls[0];
    expect(orderDto).toMatchObject({
      customer_id: 99,
      order_type: OrderType.ONE_OFF,
      contract_id: undefined,
      subscription_id: undefined,
      total_amount: '1600',
      items: [{ product_id: 1, quantity: 2, price_list_id: 1 }],
    });
    expect(options).toEqual({ origenPedido: OrigenPedido.PORTAL_CLIENTES });
    expect(prismaMock.order_header.update).not.toHaveBeenCalled();
  });

  it('POST /portal/orders con un abono activo crea HYBRID descontando de ese abono', async () => {
    mockGeneralPriceList();
    prismaMock.customer_subscription.findMany.mockResolvedValue([
      { subscription_id: 6 },
    ]);

    await postOrder({ items: [{ product_id: 1, quantity: 2 }] }, 201);

    const [orderDto] = ordersServiceMock.create.mock.calls[0];
    expect(orderDto).toMatchObject({
      order_type: OrderType.HYBRID,
      subscription_id: 6,
    });
    expect(prismaMock.customer_subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customer_id: 99, status: 'ACTIVE', is_active: true },
      }),
    );
  });

  it('POST /portal/orders con varios abonos exige elegir uno', async () => {
    mockGeneralPriceList();
    prismaMock.customer_subscription.findMany.mockResolvedValue([
      { subscription_id: 6 },
      { subscription_id: 7 },
    ]);

    const res = await postOrder(
      { items: [{ product_id: 1, quantity: 1 }] },
      400,
    );
    expect(res.body.message).toContain('más de un abono activo');

    await postOrder(
      { subscription_id: 7, items: [{ product_id: 1, quantity: 1 }] },
      201,
    );
    expect(ordersServiceMock.create.mock.calls[0][0].subscription_id).toBe(7);
  });

  it('POST /portal/orders rechaza un abono que no es del cliente', async () => {
    mockGeneralPriceList();
    prismaMock.customer_subscription.findMany.mockResolvedValue([
      { subscription_id: 6 },
    ]);

    await postOrder(
      { subscription_id: 50, items: [{ product_id: 1, quantity: 1 }] },
      400,
    );
    expect(ordersServiceMock.create).not.toHaveBeenCalled();
  });

  it('GET /portal/products devuelve precios y la cuota del abono', async () => {
    mockGeneralPriceList();
    prismaMock.customer_subscription.findMany.mockResolvedValue([
      {
        subscription_id: 6,
        subscription_plan: { name: 'Abono Familiar' },
        subscription_cycle: [
          {
            cycle_start: new Date('2026-10-01T00:00:00.000Z'),
            cycle_end: new Date('2026-10-31T00:00:00.000Z'),
            subscription_cycle_detail: [
              {
                product_id: 1,
                planned_quantity: 8,
                delivered_quantity: 3,
                remaining_balance: 5,
                product: { description: 'Bidón 20L ' },
              },
            ],
          },
        ],
      },
    ]);

    const token = await signToken();
    const res = await request(app.getHttpServer())
      .get('/portal/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.products).toEqual([
      {
        product_id: 1,
        description: 'Bidón 20L',
        volume_liters: '20.00',
        is_returnable: true,
        image_url: null,
        unit_price: '800.00',
        price_list_id: 1,
      },
    ]);
    expect(res.body.subscriptions).toEqual([
      {
        subscription_id: 6,
        plan_name: 'Abono Familiar',
        cycle_start: '2026-10-01',
        cycle_end: '2026-10-31',
        quotas: [
          {
            product_id: 1,
            description: 'Bidón 20L',
            planned_quantity: 8,
            delivered_quantity: 3,
            remaining_balance: 5,
          },
        ],
      },
    ]);
  });

  it('PATCH /portal/orders/:id bloquea si no es PENDING', async () => {
    prismaMock.order_header.findUnique.mockResolvedValue({
      ...mockOrder,
      status: OrderStatus.DELIVERED,
    });
    const token = await signToken();
    await request(app.getHttpServer())
      .patch('/portal/orders/200')
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'cambio' })
      .expect(403);
  });

  it('no permite que un cliente edite pedidos de otro (404)', async () => {
    prismaMock.order_header.findUnique.mockResolvedValue(null);
    const token = await signToken();
    await request(app.getHttpServer())
      .patch('/portal/orders/500')
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'x' })
      .expect(404);
  });
});
