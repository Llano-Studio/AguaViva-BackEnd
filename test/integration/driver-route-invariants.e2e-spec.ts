import { Prisma, PrismaClient } from '@prisma/client';
import { createTestPrisma } from '../helpers/test-db';

/**
 * Pruebas de integración contra PostgreSQL aislado.
 *
 * Verifican las garantías que la aplicación no puede sostener sola: las
 * restricciones de la base son el respaldo real ante reintentos, dispositivos
 * duplicados y solicitudes concurrentes.
 */
describe('Invariantes de choferes en PostgreSQL', () => {
  let prisma: PrismaClient;
  let driver: { id: number };
  let vehicle: { vehicle_id: number };
  let saleChannel: { sale_channel_id: number };
  let customer: { person_id: number };
  let product: { product_id: number };

  const isUniqueViolation = (error: unknown): boolean =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002';

  const captureError = async (operation: Promise<unknown>): Promise<unknown> => {
    try {
      await operation;
      return null;
    } catch (error) {
      return error;
    }
  };

  const createRouteSheet = (
    overrides: Partial<Prisma.route_sheetUncheckedCreateInput> = {},
  ) =>
    prisma.route_sheet.create({
      data: {
        driver_id: driver.id,
        vehicle_id: vehicle.vehicle_id,
        delivery_date: new Date('2026-10-20T00:00:00.000Z'),
        ...overrides,
      },
    });

  const createReconciliation = (
    routeSheetId: number,
    overrides: Partial<Prisma.route_reconciliationUncheckedCreateInput> = {},
  ) =>
    prisma.route_reconciliation.create({
      data: {
        route_sheet_id: routeSheetId,
        driver_id: driver.id,
        status: 'CONFIRMED',
        cash_to_render: new Prisma.Decimal('0.00'),
        electronic_total: new Prisma.Decimal('0.00'),
        total_collected: new Prisma.Decimal('0.00'),
        collections_by_method: {},
        product_summary: {},
        version: 'v1',
        ...overrides,
      },
    });

  beforeAll(async () => {
    prisma = createTestPrisma();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE ' +
        '"route_reconciliation", "driver_account_movement", "route_sheet_pause", ' +
        '"inventory_transaction", "route_sheet_detail", "route_sheet", ' +
        '"payment_transaction", "payment_proof", "order_header", "product", ' +
        '"product_category", "person", "vehicle", "sale_channel", "payment_method", "User" ' +
        'RESTART IDENTITY CASCADE',
    );

    driver = await prisma.user.create({
      data: {
        email: 'chofer@test.local',
        name: 'Chofer Test',
        role: 'DRIVERS',
      },
    });
    vehicle = await prisma.vehicle.create({
      data: { code: 'T1', name: 'Movil Test' },
    });
    saleChannel = await prisma.sale_channel.create({
      data: { code: 'TEST', description: 'Canal de prueba' },
    });
    await prisma.payment_method.create({
      data: { code: 'EFECTIVO', description: 'Efectivo' },
    });
    customer = await prisma.person.create({
      data: {
        name: 'Cliente Test',
        phone: '3624000000',
        type: 'INDIVIDUAL',
      },
    });
    const category = await prisma.product_category.create({
      data: { name: 'Categoria Test' },
    });
    product = await prisma.product.create({
      data: {
        category_id: category.category_id,
        description: 'Bidon 20L',
        price: new Prisma.Decimal('100.00'),
        is_returnable: true,
      },
    });
  });

  it('no permite dos hojas en curso para el mismo chofer aunque se pidan a la vez', async () => {
    const first = await createRouteSheet();
    const second = await createRouteSheet();

    const startedAt = new Date();
    const results = await Promise.allSettled([
      prisma.route_sheet.update({
        where: { route_sheet_id: first.route_sheet_id },
        data: { execution_status: 'IN_PROGRESS', started_at: startedAt },
      }),
      prisma.route_sheet.update({
        where: { route_sheet_id: second.route_sheet_id },
        data: { execution_status: 'IN_PROGRESS', started_at: startedAt },
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(
      isUniqueViolation((rejected[0] as PromiseRejectedResult).reason),
    ).toBe(true);

    const inProgress = await prisma.route_sheet.count({
      where: {
        driver_id: driver.id,
        execution_status: 'IN_PROGRESS',
        is_active: true,
      },
    });
    expect(inProgress).toBe(1);
  });

  it('permite una sola hoja en curso por chofer y libera el cupo al cerrarla', async () => {
    const first = await createRouteSheet({
      execution_status: 'IN_PROGRESS',
      started_at: new Date(),
    });
    const second = await createRouteSheet();

    expect(
      isUniqueViolation(
        await captureError(
          prisma.route_sheet.update({
            where: { route_sheet_id: second.route_sheet_id },
            data: { execution_status: 'IN_PROGRESS', started_at: new Date() },
          }),
        ),
      ),
    ).toBe(true);

    await prisma.route_sheet.update({
      where: { route_sheet_id: first.route_sheet_id },
      data: { execution_status: 'CLOSED', closed_at: new Date() },
    });

    const reopened = await prisma.route_sheet.update({
      where: { route_sheet_id: second.route_sheet_id },
      data: { execution_status: 'IN_PROGRESS', started_at: new Date() },
    });
    expect(reopened.execution_status).toBe('IN_PROGRESS');
  });

  it('no permite asignar dos veces la misma parada dentro de una hoja', async () => {
    const sheet = await createRouteSheet();
    const order = await prisma.order_header.create({
      data: {
        customer_id: customer.person_id,
        sale_channel_id: saleChannel.sale_channel_id,
        order_date: new Date('2026-10-20T00:00:00.000Z'),
        total_amount: new Prisma.Decimal('0.00'),
        paid_amount: new Prisma.Decimal('0.00'),
        order_type: 'ONE_OFF',
        status: 'PENDING',
      },
    });

    await prisma.route_sheet_detail.create({
      data: {
        route_sheet_id: sheet.route_sheet_id,
        order_id: order.order_id,
        delivery_status: 'PENDING',
      },
    });

    expect(
      isUniqueViolation(
        await captureError(
          prisma.route_sheet_detail.create({
            data: {
              route_sheet_id: sheet.route_sheet_id,
              order_id: order.order_id,
              delivery_status: 'PENDING',
            },
          }),
        ),
      ),
    ).toBe(true);
  });

  it('no vuelve a descontar stock cuando el dispositivo reintenta la misma entrega', async () => {
    const sheet = await createRouteSheet();
    const movement = {
      route_sheet_id: sheet.route_sheet_id,
      product_id: product.product_id,
      quantity: -1,
      transaction_type: 'DELIVERY',
      origin_key: `delivery:${sheet.route_sheet_id}:${product.product_id}:1`,
    };

    await prisma.inventory_transaction.create({ data: movement });

    expect(
      isUniqueViolation(
        await captureError(prisma.inventory_transaction.create({ data: movement })),
      ),
    ).toBe(true);

    const movements = await prisma.inventory_transaction.count({
      where: { origin_key: movement.origin_key },
    });
    expect(movements).toBe(1);
  });

  it('no registra dos veces el mismo cobro con la misma clave de idempotencia', async () => {
    const payment = {
      transaction_date: new Date('2026-10-20T12:00:00.000Z'),
      customer_id: customer.person_id,
      document_number: '0001',
      transaction_type: 'PAYMENT',
      previous_balance: new Prisma.Decimal('100.00'),
      transaction_amount: new Prisma.Decimal('100.00'),
      total: new Prisma.Decimal('0.00'),
      payment_method_id: 1,
      idempotency_key: 'cobro-abc-123',
    };

    await prisma.payment_transaction.create({ data: payment });

    expect(
      isUniqueViolation(
        await captureError(prisma.payment_transaction.create({ data: payment })),
      ),
    ).toBe(true);

    const payments = await prisma.payment_transaction.count({
      where: { idempotency_key: payment.idempotency_key },
    });
    expect(payments).toBe(1);
  });

  it('permite un solo cierre por hoja de ruta', async () => {
    const sheet = await createRouteSheet();
    await createReconciliation(sheet.route_sheet_id, {
      idempotency_key: 'cierre-1',
    });

    expect(
      isUniqueViolation(
        await captureError(
          createReconciliation(sheet.route_sheet_id, {
            idempotency_key: 'cierre-2',
          }),
        ),
      ),
    ).toBe(true);

    const closings = await prisma.route_reconciliation.count({
      where: { route_sheet_id: sheet.route_sheet_id },
    });
    expect(closings).toBe(1);
  });

  it('no registra dos rendiciones con la misma clave de idempotencia', async () => {
    const first = await createRouteSheet();
    const second = await createRouteSheet();

    await createReconciliation(first.route_sheet_id, {
      idempotency_key: 'reintento-movil-1',
    });

    expect(
      isUniqueViolation(
        await captureError(
          createReconciliation(second.route_sheet_id, {
            idempotency_key: 'reintento-movil-1',
          }),
        ),
      ),
    ).toBe(true);
  });

  it('no duplica movimientos de cuenta corriente con la misma clave de origen y admite varios nulos', async () => {
    await prisma.driver_account_movement.create({
      data: {
        driver_id: driver.id,
        movement_type: 'COLLECTION',
        amount: new Prisma.Decimal('100.00'),
        origin_key: 'collection:route:1',
      },
    });

    expect(
      isUniqueViolation(
        await captureError(
          prisma.driver_account_movement.create({
            data: {
              driver_id: driver.id,
              movement_type: 'COLLECTION',
              amount: new Prisma.Decimal('100.00'),
              origin_key: 'collection:route:1',
            },
          }),
        ),
      ),
    ).toBe(true);

    await prisma.driver_account_movement.create({
      data: {
        driver_id: driver.id,
        movement_type: 'ADJUSTMENT',
        amount: new Prisma.Decimal('5.00'),
      },
    });
    await prisma.driver_account_movement.create({
      data: {
        driver_id: driver.id,
        movement_type: 'ADJUSTMENT',
        amount: new Prisma.Decimal('6.00'),
      },
    });

    const movements = await prisma.driver_account_movement.count({
      where: { driver_id: driver.id },
    });
    expect(movements).toBe(3);
  });
});
