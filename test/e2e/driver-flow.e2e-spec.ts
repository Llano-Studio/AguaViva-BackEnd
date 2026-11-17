import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync, unlinkSync } from 'fs';
import * as jwt from 'jsonwebtoken';
import { join } from 'path';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { nowBAYMD, parseUTCYMD } from '../../src/common/utils/date.utils';
import { createTestPrisma } from '../helpers/test-db';

/**
 * Flujo end-to-end por HTTP del chofer y la rendición administrativa.
 *
 * Levanta la aplicación Nest real (AppModule) contra la base aislada *_test y
 * recorre el camino completo: listar hojas de ruta, iniciar el recorrido,
 * firmar, cobrar de forma idempotente, entregar u omitir paradas, rendir la hoja
 * y recibir el efectivo desde administración. La validación es por contrato
 * HTTP (códigos de estado y cuerpo), no por llamadas directas a los servicios.
 */

const API = '/api';

/** Firma PNG mínima y válida (data URI base64) para las pruebas de evidencia. */
const SIGNATURE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type RoleName = 'DRIVERS' | 'ADMINISTRATIVE' | 'SUPERADMIN' | 'BOSSADMINISTRATIVE';

interface SeededStop {
  detailId: number;
  orderId: number;
  sequence: number;
}

describe('Flujo del chofer y rendición (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaClient;

  let driver: { id: number; email: string; role: RoleName };
  let driverToken: string;
  let adminToken: string;

  let vehicle: { vehicle_id: number };
  let saleChannel: { sale_channel_id: number };
  let paymentMethod: { payment_method_id: number };
  let customer: { person_id: number };
  let product: { product_id: number };
  let today: Date;

  /** Archivos que las pruebas dejan en disco, para borrarlos al terminar. */
  const uploadedProofFiles: string[] = [];

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signToken = (user: { id: number; email: string; role: RoleName }) =>
    jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' },
    );

  /**
   * Crea una hoja del chofer con sus paradas en PENDING y el stock del camión.
   * `sequenceOrder` permite sembrar las paradas en un orden de secuencia
   * distinto al de creación, para comprobar el orden de recorrido.
   */
  const seedSheet = async (
    options: {
      stops?: number;
      sequenceOrder?: number[];
      executionStatus?: 'PLANNED' | 'IN_PROGRESS' | 'PAUSED' | 'CLOSED';
      stock?: number;
    } = {},
  ) => {
    const executionStatus = options.executionStatus ?? 'PLANNED';
    const sheet = await prisma.route_sheet.create({
      data: {
        driver_id: driver.id,
        vehicle_id: vehicle.vehicle_id,
        delivery_date: today,
        execution_status: executionStatus,
        started_at: executionStatus === 'IN_PROGRESS' ? new Date() : null,
      },
    });

    const stops: SeededStop[] = [];
    const count = options.stops ?? 1;
    for (let i = 0; i < count; i += 1) {
      const order = await prisma.order_header.create({
        data: {
          customer_id: customer.person_id,
          sale_channel_id: saleChannel.sale_channel_id,
          order_date: new Date(),
          total_amount: new Prisma.Decimal('100.00'),
          paid_amount: new Prisma.Decimal('0.00'),
          order_type: 'ONE_OFF',
          status: 'PENDING',
        },
      });
      await prisma.order_item.create({
        data: {
          order_id: order.order_id,
          product_id: product.product_id,
          quantity: 1,
          unit_price: new Prisma.Decimal('100.00'),
          subtotal: new Prisma.Decimal('100.00'),
        },
      });
      const sequence = options.sequenceOrder ? options.sequenceOrder[i] : i + 1;
      const detail = await prisma.route_sheet_detail.create({
        data: {
          route_sheet_id: sheet.route_sheet_id,
          order_id: order.order_id,
          delivery_status: 'PENDING',
          sequence_number: sequence,
        },
      });
      stops.push({
        detailId: detail.route_sheet_detail_id,
        orderId: order.order_id,
        sequence,
      });
    }

    // El stock del camión vive en vehicle_route_inventory (no en los
    // movimientos): sin esta fila la confirmación no puede descontar unidades.
    await prisma.vehicle_route_inventory.create({
      data: {
        route_sheet_id: sheet.route_sheet_id,
        product_id: product.product_id,
        initial_quantity: options.stock ?? 100,
        current_quantity: options.stock ?? 100,
        returned_quantity: 0,
      },
    });

    return { sheet, stops };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Replica el bootstrap de main.ts necesario para el contrato HTTP.
    app.setGlobalPrefix('api', { exclude: ['/', 'health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();

    // Detiene los cron jobs para que no escriban durante las pruebas.
    const registry = app.get(SchedulerRegistry, { strict: false });
    registry.getCronJobs().forEach((job) => job.stop());

    server = app.getHttpServer();
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    uploadedProofFiles.forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE ' +
        '"route_reconciliation", "driver_account_movement", "route_sheet_pause", ' +
        '"inventory_transaction", "vehicle_route_inventory", "delivery_evidence", ' +
        '"delivery_incident", "payment_transaction", "payment_proof", ' +
        '"route_sheet_detail", "route_sheet", "order_item", "order_header", ' +
        '"product", "product_category", "person", "vehicle", "sale_channel", ' +
        '"payment_method", "User" ' +
        'RESTART IDENTITY CASCADE',
    );

    const driverUser = await prisma.user.create({
      data: { email: 'chofer@test.local', name: 'Chofer Test', role: 'DRIVERS' },
    });
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@test.local',
        name: 'Admin Test',
        role: 'ADMINISTRATIVE',
      },
    });
    driver = {
      id: driverUser.id,
      email: driverUser.email,
      role: driverUser.role as RoleName,
    };
    adminToken = signToken({
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role as RoleName,
    });

    vehicle = await prisma.vehicle.create({
      data: { code: 'T1', name: 'Móvil Test' },
    });
    saleChannel = await prisma.sale_channel.create({
      data: { code: 'TEST', description: 'Canal de prueba' },
    });
    paymentMethod = await prisma.payment_method.create({
      data: { code: 'EFECTIVO', description: 'Efectivo' },
    });
    customer = await prisma.person.create({
      data: { name: 'Cliente Test', phone: '3624000000', type: 'INDIVIDUAL' },
    });
    const category = await prisma.product_category.create({
      data: { name: 'Categoría Test' },
    });
    product = await prisma.product.create({
      data: {
        category_id: category.category_id,
        description: 'Bidón 20L',
        price: new Prisma.Decimal('100.00'),
        is_returnable: true,
      },
    });

    today = parseUTCYMD(nowBAYMD());
    driverToken = signToken(driver);
  });

  it('1) GET /api/driver/route-sheets sin token responde 401', async () => {
    await request(server).get(`${API}/driver/route-sheets`).expect(401);
  });

  it('2) GET /api/driver/route-sheets con token de administración responde 403', async () => {
    await request(server)
      .get(`${API}/driver/route-sheets`)
      .set(authHeader(adminToken))
      .expect(403);
  });

  it('3) GET /api/driver/route-sheets con token de chofer responde 200 e incluye la hoja del día', async () => {
    const { sheet } = await seedSheet({ stops: 1 });

    const response = await request(server)
      .get(`${API}/driver/route-sheets`)
      .set(authHeader(driverToken))
      .expect(200);

    const ids = (response.body as any[]).map((row) => row.route_sheet_id);
    expect(ids).toContain(sheet.route_sheet_id);
  });

  it('4) GET /api/driver/route-sheets/:id devuelve las paradas ordenadas por secuencia', async () => {
    // Las paradas se crean con la secuencia desordenada (3, 1, 2) para que el
    // orden de la respuesta demuestre que se ordena por secuencia y no por ID.
    const { sheet, stops } = await seedSheet({
      stops: 3,
      sequenceOrder: [3, 1, 2],
    });

    const response = await request(server)
      .get(`${API}/driver/route-sheets/${sheet.route_sheet_id}`)
      .set(authHeader(driverToken))
      .expect(200);

    const deliveryIds = response.body.deliveries.map(
      (delivery: any) => delivery.route_sheet_detail_id,
    );
    expect(deliveryIds).toEqual([
      stops[1].detailId,
      stops[2].detailId,
      stops[0].detailId,
    ]);
    expect(
      response.body.deliveries.map((delivery: any) => delivery.position),
    ).toEqual([1, 2, 3]);
  });

  it('5) POST /api/driver/route-sheets/:id/start pasa la hoja a IN_PROGRESS', async () => {
    const { sheet } = await seedSheet({ stops: 1 });

    const response = await request(server)
      .post(`${API}/driver/route-sheets/${sheet.route_sheet_id}/start`)
      .set(authHeader(driverToken))
      .expect(200);

    expect(response.body.execution_status).toBe('IN_PROGRESS');

    const reloaded = await prisma.route_sheet.findUnique({
      where: { route_sheet_id: sheet.route_sheet_id },
    });
    expect(reloaded?.execution_status).toBe('IN_PROGRESS');
  });

  it('6) POST /api/driver/route-sheets/:id/start de una segunda hoja del mismo chofer responde 409', async () => {
    const first = await seedSheet({ stops: 1 });
    const second = await seedSheet({ stops: 1 });

    await request(server)
      .post(`${API}/driver/route-sheets/${first.sheet.route_sheet_id}/start`)
      .set(authHeader(driverToken))
      .expect(200);

    const response = await request(server)
      .post(`${API}/driver/route-sheets/${second.sheet.route_sheet_id}/start`)
      .set(authHeader(driverToken))
      .expect(409);

    expect(response.body.message).toContain('en curso');
  });

  it('7) GET /api/driver/route-sheets/:id/inventory responde 200 con el stock del camión', async () => {
    const { sheet } = await seedSheet({
      stops: 1,
      executionStatus: 'IN_PROGRESS',
      stock: 42,
    });

    const response = await request(server)
      .get(`${API}/driver/route-sheets/${sheet.route_sheet_id}/inventory`)
      .set(authHeader(driverToken))
      .expect(200);

    const item = response.body.items.find(
      (row: any) => row.product_id === product.product_id,
    );
    expect(item).toBeDefined();
    expect(item.current_quantity).toBe(42);
  });

  it('8) GET /api/driver/deliveries/:detailId/summary responde 200 con la versión del resumen', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    const response = await request(server)
      .get(`${API}/driver/deliveries/${stops[0].detailId}/summary`)
      .set(authHeader(driverToken))
      .expect(200);

    expect(response.body.version).toEqual(expect.any(String));
    expect(response.body.version.length).toBeGreaterThan(0);
    expect(response.body.requires_signature).toBe(true);
  });

  it('9) POST /api/driver/deliveries/:detailId/signature registra la firma del receptor', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });
    const summary = await request(server)
      .get(`${API}/driver/deliveries/${stops[0].detailId}/summary`)
      .set(authHeader(driverToken))
      .expect(200);

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/signature`)
      .set(authHeader(driverToken))
      .send({
        signature: SIGNATURE_DATA_URI,
        received_by_name: 'Receptor Test',
        version: summary.body.version,
      })
      .expect(200);

    expect(response.body.evidence_id).toBeGreaterThan(0);

    const evidence = await prisma.delivery_evidence.findFirst({
      where: {
        route_sheet_detail_id: stops[0].detailId,
        evidence_type: 'SIGNATURE',
      },
    });
    expect(evidence).not.toBeNull();
  });

  it('10) POST /api/driver/deliveries/:detailId/payments es idempotente con la misma clave', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    // Cobro parcial: si se cobrara la deuda completa, un reintento ya no tendría
    // saldo y el segundo intento se rechazaría antes de evaluar la idempotencia.
    const payload = {
      payment_method_id: paymentMethod.payment_method_id,
      amount: 40,
      amount_received: 40,
      idempotency_key: 'cobro-e2e-1',
    };

    const first = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/payments`)
      .set(authHeader(driverToken))
      .send(payload)
      .expect(200);
    expect(first.body.idempotent_replay).toBe(false);

    const replay = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/payments`)
      .set(authHeader(driverToken))
      .send(payload)
      .expect(200);
    expect(replay.body.idempotent_replay).toBe(true);

    const stored = await prisma.payment_transaction.count({
      where: { idempotency_key: 'cobro-e2e-1' },
    });
    expect(stored).toBe(1);
  });

  it('11) POST /api/driver/deliveries/:detailId/confirm marca la parada como DELIVERED', async () => {
    const { stops } = await seedSheet({
      stops: 1,
      executionStatus: 'IN_PROGRESS',
      stock: 5,
    });

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/signature`)
      .set(authHeader(driverToken))
      .send({ signature: SIGNATURE_DATA_URI, received_by_name: 'Receptor Test' })
      .expect(200);

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/confirm`)
      .set(authHeader(driverToken))
      .send({})
      .expect(200);

    expect(response.body.delivery_status).toBe('DELIVERED');

    const detail = await prisma.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: stops[0].detailId },
    });
    expect(detail?.delivery_status).toBe('DELIVERED');

    const order = await prisma.order_header.findUnique({
      where: { order_id: stops[0].orderId },
    });
    expect(order?.status).toBe('DELIVERED');
  });

  it('12) operar una parada que no es la actual responde 409 indicando la parada actual', async () => {
    const { stops } = await seedSheet({ stops: 2, executionStatus: 'IN_PROGRESS' });

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[1].detailId}/skip`)
      .set(authHeader(driverToken))
      .send({ reason: 'CLIENT_ABSENT' })
      .expect(409);

    expect(response.body.message).toContain('parada actual');
  });

  it('13) POST /api/driver/deliveries/:detailId/skip marca la parada como SKIPPED', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/skip`)
      .set(authHeader(driverToken))
      .send({ reason: 'CLIENT_ABSENT', notes: 'El cliente no estaba' })
      .expect(200);

    expect(response.body.delivery_status).toBe('SKIPPED');

    const detail = await prisma.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: stops[0].detailId },
    });
    expect(detail?.delivery_status).toBe('SKIPPED');
    expect(detail?.rejection_reason).toBe('CLIENT_ABSENT');
  });

  it('14) GET /api/driver/route-sheets/:id/reconciliation responde can_confirm true sin pendientes', async () => {
    const { sheet, stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/skip`)
      .set(authHeader(driverToken))
      .send({ reason: 'CLIENT_ABSENT' })
      .expect(200);

    const response = await request(server)
      .get(`${API}/driver/route-sheets/${sheet.route_sheet_id}/reconciliation`)
      .set(authHeader(driverToken))
      .expect(200);

    expect(response.body.can_confirm).toBe(true);
    expect(response.body.pending_deliveries).toBe(0);
    expect(response.body.version).toEqual(expect.any(String));
  });

  it('15) POST /api/driver/route-sheets/:id/reconciliation cierra la hoja y es idempotente', async () => {
    const { sheet, stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/skip`)
      .set(authHeader(driverToken))
      .send({ reason: 'CLIENT_ABSENT' })
      .expect(200);

    const preview = await request(server)
      .get(`${API}/driver/route-sheets/${sheet.route_sheet_id}/reconciliation`)
      .set(authHeader(driverToken))
      .expect(200);

    const payload = {
      idempotency_key: 'rendicion-e2e-1',
      version: preview.body.version,
    };

    const first = await request(server)
      .post(`${API}/driver/route-sheets/${sheet.route_sheet_id}/reconciliation`)
      .set(authHeader(driverToken))
      .send(payload)
      .expect(200);
    expect(first.body.idempotent_replay).toBe(false);

    const closed = await prisma.route_sheet.findUnique({
      where: { route_sheet_id: sheet.route_sheet_id },
    });
    expect(closed?.execution_status).toBe('CLOSED');

    const replay = await request(server)
      .post(`${API}/driver/route-sheets/${sheet.route_sheet_id}/reconciliation`)
      .set(authHeader(driverToken))
      .send(payload)
      .expect(200);
    expect(replay.body.idempotent_replay).toBe(true);
  });

  it('16) GET /api/driver/me/account responde 200 con el saldo de la cuenta', async () => {
    await prisma.driver_account_movement.create({
      data: {
        driver_id: driver.id,
        movement_type: 'CASH_COLLECTED',
        amount: new Prisma.Decimal('100.00'),
        origin_key: 'e2e:movement:1',
      },
    });

    const response = await request(server)
      .get(`${API}/driver/me/account`)
      .set(authHeader(driverToken))
      .expect(200);

    expect(response.body.balance).toBe('100.00');
  });

  it('17) administración lista la rendición, recibe el efectivo y registra un ajuste', async () => {
    const { sheet, stops } = await seedSheet({
      stops: 1,
      executionStatus: 'IN_PROGRESS',
      stock: 10,
    });

    // Cobro parcial en efectivo: deja efectivo a rendir para poder recibirlo.
    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/payments`)
      .set(authHeader(driverToken))
      .send({
        payment_method_id: paymentMethod.payment_method_id,
        amount: 40,
        amount_received: 40,
        idempotency_key: 'admin-flow-pay',
      })
      .expect(200);

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/signature`)
      .set(authHeader(driverToken))
      .send({ signature: SIGNATURE_DATA_URI, received_by_name: 'Receptor Test' })
      .expect(200);

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/confirm`)
      .set(authHeader(driverToken))
      .send({})
      .expect(200);

    const preview = await request(server)
      .get(`${API}/driver/route-sheets/${sheet.route_sheet_id}/reconciliation`)
      .set(authHeader(driverToken))
      .expect(200);
    expect(preview.body.totals.cash_to_render).toBe('40.00');

    const reconciliation = await request(server)
      .post(`${API}/driver/route-sheets/${sheet.route_sheet_id}/reconciliation`)
      .set(authHeader(driverToken))
      .send({ idempotency_key: 'admin-flow-rec', version: preview.body.version })
      .expect(200);
    const reconciliationId = reconciliation.body.reconciliation_id;
    expect(reconciliation.body.status).toBe('CONFIRMED');

    const list = await request(server)
      .get(`${API}/route-reconciliations`)
      .set(authHeader(adminToken))
      .expect(200);
    const listedIds = (list.body.items as any[]).map(
      (row) => row.reconciliation_id,
    );
    expect(listedIds).toContain(reconciliationId);

    const cash = await request(server)
      .post(`${API}/route-reconciliations/${reconciliationId}/receive-cash`)
      .set(authHeader(adminToken))
      .send({ amount: 40, idempotency_key: 'admin-flow-cash' })
      .expect(200);
    expect(cash.body.status).toBe('CASH_RECEIVED');

    const adjustment = await request(server)
      .post(`${API}/route-reconciliations/${reconciliationId}/adjustment`)
      .set(authHeader(adminToken))
      .send({ amount: 10, reason: 'BONUS', idempotency_key: 'admin-flow-adj' })
      .expect(200);
    expect(adjustment.body.reconciliation_id).toBe(reconciliationId);
  });

  it('18) operar una parada de una hoja en PLANNED responde 409 por no estar en curso', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'PLANNED' });

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/skip`)
      .set(authHeader(driverToken))
      .send({ reason: 'CLIENT_ABSENT' })
      .expect(409);

    expect(response.body.message).toContain('no está en curso');
  });

  it('19) POST /api/driver/deliveries/:detailId/items agrega un producto y al confirmar descuenta el stock del camión', async () => {
    const { sheet, stops } = await seedSheet({
      stops: 1,
      executionStatus: 'IN_PROGRESS',
      stock: 5,
    });

    // Producto que el cliente pide en el momento y que ya viene cargado en el camión.
    const category = await prisma.product_category.create({
      data: { name: 'Categoría Extra' },
    });
    const extraProduct = await prisma.product.create({
      data: {
        category_id: category.category_id,
        description: 'Botella 500ml',
        price: new Prisma.Decimal('50.00'),
        is_returnable: false,
      },
    });
    await prisma.vehicle_route_inventory.create({
      data: {
        route_sheet_id: sheet.route_sheet_id,
        product_id: extraProduct.product_id,
        initial_quantity: 5,
        current_quantity: 5,
        returned_quantity: 0,
      },
    });

    const added = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/items`)
      .set(authHeader(driverToken))
      .send({ items: [{ product_id: extraProduct.product_id, quantity: 2 }] })
      .expect(200);

    expect(added.body.route_sheet_detail_id).toBe(stops[0].detailId);

    const orderItem = await prisma.order_item.findFirst({
      where: {
        order_id: stops[0].orderId,
        product_id: extraProduct.product_id,
      },
    });
    expect(orderItem?.quantity).toBe(2);

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/signature`)
      .set(authHeader(driverToken))
      .send({ signature: SIGNATURE_DATA_URI, received_by_name: 'Receptor Test' })
      .expect(200);

    const confirmed = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/confirm`)
      .set(authHeader(driverToken))
      .send({})
      .expect(200);
    expect(confirmed.body.delivery_status).toBe('DELIVERED');

    const inventory = await prisma.vehicle_route_inventory.findFirst({
      where: {
        route_sheet_id: sheet.route_sheet_id,
        product_id: extraProduct.product_id,
      },
    });
    expect(inventory?.current_quantity).toBe(3);
  });

  it('20) POST /api/driver/deliveries/:detailId/items con cantidad mayor al stock responde 409', async () => {
    const { stops } = await seedSheet({
      stops: 1,
      executionStatus: 'IN_PROGRESS',
      stock: 5,
    });

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/items`)
      .set(authHeader(driverToken))
      .send({ items: [{ product_id: product.product_id, quantity: 100 }] })
      .expect(409);

    expect(response.body.message).toContain('Stock insuficiente');
  });

  it('21) pausar impide operar la parada y reanudar la vuelve a habilitar', async () => {
    const { sheet, stops } = await seedSheet({
      stops: 1,
      executionStatus: 'IN_PROGRESS',
    });

    const paused = await request(server)
      .post(`${API}/driver/route-sheets/${sheet.route_sheet_id}/pause`)
      .set(authHeader(driverToken))
      .send({ reason: 'RESTOCK' })
      .expect(200);
    expect(paused.body.execution_status).toBe('PAUSED');

    const blocked = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/skip`)
      .set(authHeader(driverToken))
      .send({ reason: 'CLIENT_ABSENT' })
      .expect(409);
    expect(blocked.body.message).toContain('no está en curso');

    const resumed = await request(server)
      .post(`${API}/driver/route-sheets/${sheet.route_sheet_id}/resume`)
      .set(authHeader(driverToken))
      .expect(200);
    expect(resumed.body.execution_status).toBe('IN_PROGRESS');
  });

  it('22) pausar con motivo OTHER sin notas responde 400', async () => {
    const { sheet } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    const response = await request(server)
      .post(`${API}/driver/route-sheets/${sheet.route_sheet_id}/pause`)
      .set(authHeader(driverToken))
      .send({ reason: 'OTHER' })
      .expect(400);

    // La validación puede devolver varios mensajes (array) cuando el campo
    // `notes` falta y además no es string.
    const messages = Array.isArray(response.body.message)
      ? response.body.message.join(' | ')
      : response.body.message;
    expect(messages).toContain('notas son obligatorias');
  });

  it('23) confirmar un pedido prepagado cierra la parada sin saldo pendiente', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    // Pedido ya cobrado en su totalidad: paid_amount === total_amount.
    await prisma.order_header.update({
      where: { order_id: stops[0].orderId },
      data: {
        paid_amount: new Prisma.Decimal('100.00'),
        payment_status: 'PAID',
      },
    });

    const summary = await request(server)
      .get(`${API}/driver/deliveries/${stops[0].detailId}/summary`)
      .set(authHeader(driverToken))
      .expect(200);
    expect(summary.body.totals.pending_amount).toBe('0.00');

    // Los métodos de pago siguen disponibles aunque no haya nada que cobrar.
    const options = await request(server)
      .get(`${API}/driver/payment-options`)
      .set(authHeader(driverToken))
      .expect(200);
    expect(Array.isArray(options.body.methods)).toBe(true);

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/signature`)
      .set(authHeader(driverToken))
      .send({ signature: SIGNATURE_DATA_URI, received_by_name: 'Receptor Test' })
      .expect(200);

    const confirmed = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/confirm`)
      .set(authHeader(driverToken))
      .send({})
      .expect(200);
    expect(confirmed.body.delivery_status).toBe('DELIVERED');
    expect(confirmed.body.order_status).toBe('DELIVERED');
  });

  it('24) un pago parcial confirma la parada y deja el saldo del pedido pendiente', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/payments`)
      .set(authHeader(driverToken))
      .send({
        payment_method_id: paymentMethod.payment_method_id,
        amount: 30,
        amount_received: 30,
        idempotency_key: 'parcial-e2e-1',
      })
      .expect(200);

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/signature`)
      .set(authHeader(driverToken))
      .send({ signature: SIGNATURE_DATA_URI, received_by_name: 'Receptor Test' })
      .expect(200);

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/confirm`)
      .set(authHeader(driverToken))
      .send({})
      .expect(200);

    const order = await prisma.order_header.findUnique({
      where: { order_id: stops[0].orderId },
    });
    // Cobró 30 de 100: el pedido queda entregado pero con 70 pendientes.
    expect(order?.paid_amount.toFixed(2)).toBe('30.00');
    expect(order?.status).toBe('DELIVERED');
  });

  it('25) confirmar sin firma ni motivo responde 409', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/confirm`)
      .set(authHeader(driverToken))
      .send({})
      .expect(409);

    expect(response.body.message).toContain('Falta la firma del receptor');
  });

  it('26) confirmar sin firma pero con motivo autorizado confirma la entrega', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/confirm`)
      .set(authHeader(driverToken))
      .send({ signature_missing_reason: 'DEVICE_UNAVAILABLE' })
      .expect(200);

    expect(response.body.delivery_status).toBe('DELIVERED');
    expect(response.body.signature_present).toBe(false);
    expect(response.body.signature_missing_reason).toBe('DEVICE_UNAVAILABLE');

    const detail = await prisma.route_sheet_detail.findUnique({
      where: { route_sheet_detail_id: stops[0].detailId },
    });
    expect(detail?.delivery_status).toBe('DELIVERED');
  });

  it('27) confirmar con una versión obsoleta responde 409', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    const summary = await request(server)
      .get(`${API}/driver/deliveries/${stops[0].detailId}/summary`)
      .set(authHeader(driverToken))
      .expect(200);
    const staleVersion = summary.body.version;

    // Un cobro parcial cambia el estado mutable y con él la versión del resumen.
    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/payments`)
      .set(authHeader(driverToken))
      .send({
        payment_method_id: paymentMethod.payment_method_id,
        amount: 10,
        amount_received: 10,
        idempotency_key: 'version-e2e-1',
      })
      .expect(200);

    const response = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/confirm`)
      .set(authHeader(driverToken))
      .send({ version: staleVersion })
      .expect(409);

    expect(response.body.message).toContain(
      'El resumen cambió desde la última consulta',
    );
  });

  it('28) POST /api/driver/deliveries/:detailId/payment-proofs sube el comprobante y GET lo lista', async () => {
    const { stops } = await seedSheet({ stops: 1, executionStatus: 'IN_PROGRESS' });

    // El tipo es obligatorio y debe pertenecer al enum del contrato.
    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/payment-proofs`)
      .set(authHeader(driverToken))
      .field('kind', 'OTRO')
      .attach('file', Buffer.from('comprobante de prueba'), 'comprobante.png')
      .expect(400);

    const upload = await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/payment-proofs`)
      .set(authHeader(driverToken))
      .field('kind', 'TRANSFER_RECEIPT')
      .field('notes', 'transferencia del cliente')
      .attach('file', Buffer.from('comprobante de prueba'), 'comprobante.png')
      .expect(201);

    expect(upload.body.kind).toBe('TRANSFER_RECEIPT');
    expect(upload.body.notes).toBe('transferencia del cliente');
    // El nombre en disco lo genera el backend (no conserva el original) y mantiene la extensión.
    expect(upload.body.file_name).toMatch(/\.png$/);
    expect(upload.body.file_name).not.toBe('comprobante.png');
    expect(upload.body.mime_type).toBe('image/png');
    expect(upload.body.size_bytes).toBe(21);
    expect(upload.body.uploaded_by).toBe(driver.id);
    expect(upload.body.url).toContain('payment-proofs');

    // El archivo realmente quedó en disco; se borra en el afterAll.
    const filePath = join(
      process.cwd(),
      'public/uploads/payment-proofs',
      upload.body.file_name,
    );
    expect(existsSync(filePath)).toBe(true);
    uploadedProofFiles.push(filePath);

    const list = await request(server)
      .get(`${API}/driver/deliveries/${stops[0].detailId}/payment-proofs`)
      .set(authHeader(driverToken))
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].proof_id).toBe(upload.body.proof_id);
    expect(list.body[0].kind).toBe('TRANSFER_RECEIPT');
    expect(list.body[0].url).toContain('payment-proofs');
  });

  it('29) cerrar la hoja con diferencias de conteo registra la diferencia sin bloquear', async () => {
    const { sheet, stops } = await seedSheet({
      stops: 1,
      executionStatus: 'IN_PROGRESS',
    });

    await request(server)
      .post(`${API}/driver/deliveries/${stops[0].detailId}/skip`)
      .set(authHeader(driverToken))
      .send({ reason: 'CLIENT_ABSENT' })
      .expect(200);

    const preview = await request(server)
      .get(`${API}/driver/route-sheets/${sheet.route_sheet_id}/reconciliation`)
      .set(authHeader(driverToken))
      .expect(200);

    // El conteo informado (5) difiere de lo esperado (0): no hay movimientos de
    // inventario en esta hoja, solo la fila de stock del camión.
    const response = await request(server)
      .post(`${API}/driver/route-sheets/${sheet.route_sheet_id}/reconciliation`)
      .set(authHeader(driverToken))
      .send({
        idempotency_key: 'rendicion-dif-e2e-1',
        version: preview.body.version,
        counted_items: [{ product_id: product.product_id, counted_quantity: 5 }],
      })
      .expect(200);

    const difference = (response.body.differences as any[]).find(
      (row) => row.product_id === product.product_id,
    );
    expect(difference).toBeDefined();
    expect(difference.difference).toBe(5);

    const closed = await prisma.route_sheet.findUnique({
      where: { route_sheet_id: sheet.route_sheet_id },
    });
    expect(closed?.execution_status).toBe('CLOSED');
  });
});
