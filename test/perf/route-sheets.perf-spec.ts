import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { nowBAYMD, parseUTCYMD } from '../../src/common/utils/date.utils';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createTestPrisma, getTestDatabaseUrl } from '../helpers/test-db';

/**
 * Banco de PRUEBAS DE PERFORMANCE del módulo de choferes con hojas de ruta
 * GRANDES. Es una tarea de MEDICIÓN: no optimiza nada ni toca `src/**`.
 *
 * Para cada tamaño N de paradas ({50, 200}) siembra una hoja con N paradas y mide,
 * con al menos 10 repeticiones (descartando la primera como warm-up):
 *   - latencia p50 y p95 en ms,
 *   - cantidad de consultas SQL por request.
 *
 * El conteo de consultas se hace reemplazando `PrismaService` por un
 * `PrismaClient` con logging de queries en modo evento. Así se cuentan TODAS las
 * sentencias que la aplicación ejecuta durante un request (incluida la consulta
 * del guard JWT). Ver la nota de honestidad en el reporte.
 *
 * Correr con: npx jest --config ./test/jest-perf.json
 */

// ---------------------------------------------------------------------------
// UMBRALES DE ACEPTACIÓN (generosos y estables, para evitar flakiness).
// Los números finos van al reporte, no a assertions ajustadas.
// ---------------------------------------------------------------------------
const SIZES = [50, 200];
const ITERATIONS = 10; // repeticiones medidas por endpoint (sin warm-up)
const WARMUP_ITERATIONS = 1; // la primera llamada se descarta
const P95_MAX_MS = 2000; // p95 aceptable con N=200
const MAX_QUERIES_PER_REQUEST = 1000; // techo GENEROSO: solo atrapa regresiones catastróficas.
const START_MAX_MS = 5000; // la mutación `start` con N=200 debe ser acotada

const API = '/api';

type RoleName = 'DRIVERS' | 'ADMINISTRATIVE' | 'SUPERADMIN' | 'BOSSADMINISTRATIVE';

interface SeedResult {
  sheetId: number;
  firstDetailId: number;
  stopCount: number;
  driverToken: string;
  adminToken: string;
}

interface PerfRow {
  endpoint: string;
  n: number;
  p50: number;
  p95: number;
  queries: number;
}

// ---------------------------------------------------------------------------
// Conteo de consultas: cliente propio con logging en modo evento.
// ---------------------------------------------------------------------------
const queryClient = new PrismaClient({
  datasourceUrl: getTestDatabaseUrl(),
  log: [{ emit: 'event', level: 'query' }],
});
let requestQueryCount = 0;
// @ts-expect-error: $on('query') existe porque habilitamos el logging de eventos.
queryClient.$on('query', () => {
  requestQueryCount += 1;
});

function signToken(user: { id: number; email: string; role: RoleName }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '1h' },
  );
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) {
    return 0;
  }
  const index = Math.ceil((p / 100) * sortedAsc.length) - 1;
  return sortedAsc[Math.max(0, Math.min(sortedAsc.length - 1, index))];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

describe('Performance de hojas de ruta con N paradas (perf)', () => {
  let app: INestApplication;
  let server: any;
  let seederPrisma: PrismaClient;

  const driver: { id: number; email: string; role: RoleName } = {
    id: 0,
    email: 'chofer-perf@test.local',
    role: 'DRIVERS',
  };
  const admin: { id: number; email: string; role: RoleName } = {
    id: 0,
    email: 'admin-perf@test.local',
    role: 'ADMINISTRATIVE',
  };
  let vehicleId = 0;
  let productId = 0;
  let customerId = 0;
  let saleChannelId = 0;

  const allRows: PerfRow[] = [];

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  /**
   * Mide un endpoint: ejecuta `run` (una espera a la respuesta HTTP), descarta la
   * primera llamada como warm-up y devuelve p50/p95 y las consultas del último
   * request medido. El contador se resetea antes de cada llamada.
   */
  const measure = async (
    endpoint: string,
    n: number,
    run: () => Promise<unknown>,
  ): Promise<PerfRow> => {
    const latencies: number[] = [];
    let queries = 0;
    const total = WARMUP_ITERATIONS + ITERATIONS;
    for (let i = 0; i < total; i += 1) {
      requestQueryCount = 0;
      const start = process.hrtime.bigint();
      await run();
      const end = process.hrtime.bigint();
      if (i < WARMUP_ITERATIONS) {
        continue; // warm-up descartado
      }
      latencies.push(Number(end - start) / 1e6);
      queries = requestQueryCount;
    }
    const sorted = [...latencies].sort((a, b) => a - b);
    const row: PerfRow = {
      endpoint,
      n,
      p50: round2(percentile(sorted, 50)),
      p95: round2(percentile(sorted, 95)),
      queries,
    };
    allRows.push(row);
    return row;
  };

  /** Mide una mutación con una sola llamada (se informa el tiempo tal cual). */
  const measureOnce = async (
    endpoint: string,
    n: number,
    run: () => Promise<unknown>,
  ): Promise<PerfRow> => {
    requestQueryCount = 0;
    const start = process.hrtime.bigint();
    await run();
    const end = process.hrtime.bigint();
    const elapsed = round2(Number(end - start) / 1e6);
    const row: PerfRow = {
      endpoint: `${endpoint} (1 llamada)`,
      n,
      p50: elapsed,
      p95: elapsed,
      queries: requestQueryCount,
    };
    allRows.push(row);
    return row;
  };

  /**
   * Siembra una hoja con N paradas. Usa createMany por lote para que el seeding
   * no domine el tiempo. Devuelve el tiempo de seeding (se reporta aparte).
   */
  const seedSheet = async (n: number): Promise<SeedResult> => {
    const t0 = process.hrtime.bigint();

    await seederPrisma.$executeRawUnsafe(
      'TRUNCATE TABLE ' +
        '"route_reconciliation", "driver_account_movement", "route_sheet_pause", ' +
        '"inventory_transaction", "vehicle_route_inventory", "delivery_evidence", ' +
        '"delivery_incident", "payment_transaction", "payment_proof", ' +
        '"route_sheet_detail", "route_sheet", "order_item", "order_header", ' +
        '"product", "product_category", "person", "vehicle", "sale_channel", ' +
        '"payment_method", "User" ' +
        'RESTART IDENTITY CASCADE',
    );

    const driverUser = await seederPrisma.user.create({
      data: { email: driver.email, name: 'Chofer Perf', role: 'DRIVERS' },
    });
    const adminUser = await seederPrisma.user.create({
      data: { email: admin.email, name: 'Admin Perf', role: 'ADMINISTRATIVE' },
    });
    driver.id = driverUser.id;
    admin.id = adminUser.id;

    const vehicle = await seederPrisma.vehicle.create({
      data: { code: 'PERF1', name: 'Móvil Perf' },
    });
    vehicleId = vehicle.vehicle_id;

    const saleChannel = await seederPrisma.sale_channel.create({
      data: { code: 'PERF', description: 'Canal Perf' },
    });
    saleChannelId = saleChannel.sale_channel_id;

    await seederPrisma.payment_method.create({
      data: { code: 'EFECTIVO', description: 'Efectivo' },
    });

    const customer = await seederPrisma.person.create({
      data: { name: 'Cliente Perf', phone: '3624000001', type: 'INDIVIDUAL' },
    });
    customerId = customer.person_id;

    const category = await seederPrisma.product_category.create({
      data: { name: 'Cat Perf' },
    });
    const product = await seederPrisma.product.create({
      data: {
        category_id: category.category_id,
        description: 'Bidón 20L Perf',
        price: new Prisma.Decimal('100.00'),
        is_returnable: true,
      },
    });
    productId = product.product_id;

    const today = parseUTCYMD(nowBAYMD());
    const sheet = await seederPrisma.route_sheet.create({
      data: {
        driver_id: driver.id,
        vehicle_id: vehicleId,
        delivery_date: today,
        execution_status: 'PLANNED',
      },
    });

    // Órdenes, items y paradas por lote.
    await seederPrisma.order_header.createMany({
      data: Array.from({ length: n }, () => ({
        customer_id: customerId,
        sale_channel_id: saleChannelId,
        order_date: new Date(),
        total_amount: new Prisma.Decimal('100.00'),
        paid_amount: new Prisma.Decimal('0.00'),
        order_type: 'ONE_OFF',
        status: 'PENDING',
      })),
    });
    const orders = await seederPrisma.order_header.findMany({
      select: { order_id: true },
      orderBy: { order_id: 'asc' },
    });

    await seederPrisma.order_item.createMany({
      data: orders.map((order) => ({
        order_id: order.order_id,
        product_id: productId,
        quantity: 1,
        unit_price: new Prisma.Decimal('100.00'),
        subtotal: new Prisma.Decimal('100.00'),
      })),
    });

    await seederPrisma.route_sheet_detail.createMany({
      data: orders.map((order, index) => ({
        route_sheet_id: sheet.route_sheet_id,
        order_id: order.order_id,
        delivery_status: 'PENDING',
        sequence_number: index + 1,
      })),
    });

    // El stock del camión vive en vehicle_route_inventory.
    await seederPrisma.vehicle_route_inventory.create({
      data: {
        route_sheet_id: sheet.route_sheet_id,
        product_id: productId,
        initial_quantity: 1000,
        current_quantity: 1000,
        returned_quantity: 0,
      },
    });

    const details = await seederPrisma.route_sheet_detail.findMany({
      where: { route_sheet_id: sheet.route_sheet_id },
      select: { route_sheet_detail_id: true },
      orderBy: { sequence_number: 'asc' },
    });

    const t1 = process.hrtime.bigint();
    const seedMs = Number(t1 - t0) / 1e6;
    console.log(
      `[seed] N=${n} → ${n} paradas sembradas en ${round2(seedMs)} ms`,
    );

    return {
      sheetId: sheet.route_sheet_id,
      firstDetailId: details[0].route_sheet_detail_id,
      stopCount: details.length,
      driverToken: signToken(driver),
      adminToken: signToken(admin),
    };
  };

  beforeAll(async () => {
    await queryClient.$connect();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Se reemplaza el PrismaService de la app por el cliente con logging de
      // queries. No se modifica `src/**`; es un override del módulo de test.
      .overrideProvider(PrismaService)
      .useValue(queryClient)
      .compile();

    app = moduleRef.createNestApplication();
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

    const registry = app.get(SchedulerRegistry, { strict: false });
    registry.getCronJobs().forEach((job) => job.stop());

    server = app.getHttpServer();
    seederPrisma = createTestPrisma();
  });

  afterAll(async () => {
    // Limpieza: deja la base _test sin los datos sembrados.
    if (seederPrisma) {
      await seederPrisma.$executeRawUnsafe(
        'TRUNCATE TABLE ' +
          '"route_reconciliation", "driver_account_movement", "route_sheet_pause", ' +
          '"inventory_transaction", "vehicle_route_inventory", "delivery_evidence", ' +
          '"delivery_incident", "payment_transaction", "payment_proof", ' +
          '"route_sheet_detail", "route_sheet", "order_item", "order_header", ' +
          '"product", "product_category", "person", "vehicle", "sale_channel", ' +
          '"payment_method", "User" ' +
          'RESTART IDENTITY CASCADE',
      );
      await seederPrisma.$disconnect();
    }
    await app?.close();
    await queryClient.$disconnect();
  });

  const runSuite = async (n: number) => {
    const seed = await seedSheet(n);
    const auth = authHeader(seed.driverToken);
    const adminAuth = authHeader(seed.adminToken);
    const sheetUrl = `${API}/driver/route-sheets/${seed.sheetId}`;

    await measure('GET /api/driver/route-sheets', n, () =>
      request(server).get(`${API}/driver/route-sheets`).set(auth).expect(200),
    );

    await measure('GET /api/driver/route-sheets/:id', n, () =>
      request(server).get(sheetUrl).set(auth).expect(200),
    );

    await measure('GET /api/driver/route-sheets/:id/inventory', n, () =>
      request(server).get(`${sheetUrl}/inventory`).set(auth).expect(200),
    );

    await measure('GET /api/driver/deliveries/:detailId/summary', n, () =>
      request(server)
        .get(`${API}/driver/deliveries/${seed.firstDetailId}/summary`)
        .set(auth)
        .expect(200),
    );

    await measure('GET /api/driver/route-sheets/:id/reconciliation (preview)', n, () =>
      request(server)
        .get(`${sheetUrl}/reconciliation`)
        .set(auth)
        .expect(200),
    );

    await measure('GET /api/route-sheets (admin list)', n, () =>
      request(server)
        .get(`${API}/route-sheets`)
        .query({ page: 1, limit: 20 })
        .set(adminAuth)
        .expect(200),
    );

    await measure('GET /api/route-sheets/:id (admin detail)', n, () =>
      request(server).get(`${API}/route-sheets/${seed.sheetId}`).set(adminAuth).expect(200),
    );

    // Mutación: una sola llamada por N (la hoja pasa a IN_PROGRESS).
    await measureOnce('POST /api/driver/route-sheets/:id/start', n, () =>
      request(server).post(`${sheetUrl}/start`).set(auth).expect(200),
    );
  };

  it('mide los endpoints con N=50', async () => {
    await runSuite(50);
  });

  it('mide los endpoints con N=200', async () => {
    await runSuite(200);
  });

  it('imprime la tabla y detecta consultas que crecen con N', () => {
    const header = [
      'endpoint'.padEnd(52),
      'N'.padStart(5),
      'p50(ms)'.padStart(9),
      'p95(ms)'.padStart(9),
      'queries'.padStart(9),
    ].join(' | ');
    console.log('\n=== Resultados de performance (latencia y consultas SQL) ===');
    console.log(header);
    console.log('-'.repeat(header.length));
    for (const row of allRows) {
      console.log(
        [
          row.endpoint.padEnd(52),
          String(row.n).padStart(5),
          row.p50.toFixed(2).padStart(9),
          row.p95.toFixed(2).padStart(9),
          String(row.queries).padStart(9),
        ].join(' | '),
      );
    }

    // Detección de posible N+1: consultas por request que crecen con N.
    console.log('\n=== Análisis de crecimiento de consultas con N ===');
    const byEndpoint = new Map<string, Map<number, number>>();
    for (const row of allRows) {
      const key = row.endpoint.replace(' (1 llamada)', '');
      if (!byEndpoint.has(key)) {
        byEndpoint.set(key, new Map());
      }
      byEndpoint.get(key)!.set(row.n, row.queries);
    }
    let anyGrowth = false;
    for (const [endpoint, counts] of byEndpoint) {
      const at50 = counts.get(50);
      const at200 = counts.get(200);
      if (at50 !== undefined && at200 !== undefined && at200 > at50) {
        anyGrowth = true;
        console.log(
          `  ⚠️  ${endpoint}: ${at50} consultas con N=50 y ${at200} con N=200 ` +
            `(+${at200 - at50}) → CANDIDATO A N+1`,
        );
      }
    }
    if (!anyGrowth) {
      console.log(
        '  ✅ Ningún endpoint incrementó la cantidad de consultas al pasar de N=50 a N=200.',
      );
    }

    // Assertions: umbrales generosos y estables (solo para no flakear).
    for (const row of allRows) {
      if (row.n === 200 && !row.endpoint.includes('(1 llamada)')) {
        expect(row.p95).toBeLessThan(P95_MAX_MS);
      }
      expect(row.queries).toBeLessThan(MAX_QUERIES_PER_REQUEST);
      if (row.endpoint.includes('start') && row.n === 200) {
        expect(row.p95).toBeLessThan(START_MAX_MS);
      }
    }
    expect(allRows.length).toBeGreaterThan(0);
  });
});
