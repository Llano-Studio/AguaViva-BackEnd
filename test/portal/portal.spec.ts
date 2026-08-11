import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { PortalService } from '../src/portal/portal.service';
import { PortalController } from '../src/portal/portal.controller';
import { OrdersService } from '../src/orders/orders.service';
import { LoginServiceClient } from '../src/portal/services/login-service.client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrderStatus, OrigenPedido, OrderType } from '../src/common/constants/enums';
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
      person: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      order_header: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      product: { findUnique: jest.fn() },
      price_list_item: { findFirst: jest.fn() },
      client_contract: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };

    ordersServiceMock = {
      create: jest.fn().mockImplementation(async (dto) => ({ ...mockOrder, ...dto })),
      update: jest.fn().mockImplementation(async (id, dto) => ({ ...mockOrder, ...dto })),
      findOne: jest.fn().mockImplementation(async (id) => ({ ...mockOrder, order_id: id })),
    };

    loginServiceClientMock = {
      syncCredential: jest.fn().mockResolvedValue({ id: 1 }),
      disableCredential: jest.fn().mockResolvedValue(true),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [
        PortalService,
        { provide: 'PrismaService', useValue: prismaMock },
        { provide: OrdersService, useValue: ordersServiceMock },
        { provide: LoginServiceClient, useValue: loginServiceClientMock },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              ({ CLIENT_PORTAL_JWT_SECRET: 'test-secret', MODULE_SYSTEM_CODE: 'AGUAVIVA' })[k],
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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

  it('POST /portal/orders marca origen PORTAL_CLIENTES', async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      product_id: 1,
      price: new Decimal(800),
      description: 'Producto AguaViva',
    });
    prismaMock.price_list_item.findFirst.mockResolvedValue(null);
    prismaMock.client_contract.findFirst.mockResolvedValue(null);
    prismaMock.order_header.update.mockResolvedValue({
      ...mockOrder,
      origen_pedido: OrigenPedido.PORTAL_CLIENTES,
    });

    const token = await signToken();
    const res = await request(app.getHttpServer())
      .post('/portal/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product_id: 1, quantity: 1 }] })
      .expect(201);

    expect(res.body.customer_id).toBe(99);
    expect(prismaMock.order_header.update).toHaveBeenCalled();
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
