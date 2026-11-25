jest.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClientMock {},
  SubscriptionStatus: { ACTIVE: 'ACTIVE' },
}));

import { SubscriptionCycleRenewalService } from './subscription-cycle-renewal.service';

// Fecha de BD (@db.Date): medianoche UTC
const dbDate = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
// Fecha que el servicio manda a la BD (medianoche de Buenos Aires)
const baDate = (ymd: string) => new Date(`${ymd}T00:00:00.000-03:00`);

describe('SubscriptionCycleRenewalService', () => {
  const buildService = () => {
    const prisma = {
      customer_subscription: { findMany: jest.fn() },
      subscription_cycle: { findFirst: jest.fn() },
      subscription_cycle_detail: { create: jest.fn() },
    } as any;
    const cycleNumberingService = {
      createCycleWithNumber: jest.fn().mockResolvedValue({ cycle_id: 1 }),
    } as any;
    const cycleCalculatorService = {
      calculateAndUpdateCycleAmount: jest.fn(),
    } as any;

    const service = new SubscriptionCycleRenewalService(
      prisma,
      cycleNumberingService,
      cycleCalculatorService,
    ) as any;
    service.checkAndApplyLateFees = jest.fn();
    prisma.subscription_cycle.findFirst.mockResolvedValue(null);

    return { service, prisma, cycleNumberingService };
  };

  const subscription = (lastCycleEnd: string, extra: any = {}) => ({
    subscription_id: 123,
    payment_mode: 'ADVANCE',
    payment_due_day: null,
    subscription_plan: {
      subscription_plan_product: [{ product_id: 3, product_quantity: 6 }],
    },
    subscription_cycle: [{ cycle_id: 10, cycle_end: dbDate(lastCycleEnd) }],
    ...extra,
  });

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('renueva al día siguiente del último ciclo, por un mes, venciendo el día de cobro (ADVANCE)', async () => {
    jest.setSystemTime(new Date('2026-12-20T01:00:00-03:00'));
    const { service, prisma, cycleNumberingService } = buildService();
    prisma.customer_subscription.findMany.mockResolvedValue([
      subscription('2026-12-19'),
    ]);

    await service.renewExpiredCycles();

    expect(cycleNumberingService.createCycleWithNumber).toHaveBeenCalledTimes(1);
    expect(cycleNumberingService.createCycleWithNumber).toHaveBeenCalledWith(123, {
      cycle_start: baDate('2026-12-20'),
      cycle_end: baDate('2027-01-19'),
      payment_due_date: baDate('2026-12-20'),
      total_amount: 0,
    });
    expect(prisma.subscription_cycle_detail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ product_id: 3, planned_quantity: 6 }),
    });
  });

  it('no renueva si el último ciclo todavía está en curso (un solo ciclo por mes)', async () => {
    jest.setSystemTime(new Date('2026-12-21T01:00:00-03:00'));
    const { service, prisma, cycleNumberingService } = buildService();
    // El ciclo 1 terminó hace rato, pero el último (creado ayer) sigue vigente
    prisma.customer_subscription.findMany.mockResolvedValue([
      subscription('2027-01-19'),
    ]);

    await service.renewExpiredCycles();

    expect(cycleNumberingService.createCycleWithNumber).not.toHaveBeenCalled();
  });

  it('no crea ciclo si ya existe uno que cubre el período', async () => {
    jest.setSystemTime(new Date('2026-12-20T01:00:00-03:00'));
    const { service, prisma, cycleNumberingService } = buildService();
    prisma.customer_subscription.findMany.mockResolvedValue([
      subscription('2026-12-19'),
    ]);
    prisma.subscription_cycle.findFirst.mockResolvedValue({ cycle_id: 999 });

    await service.renewExpiredCycles();

    expect(cycleNumberingService.createCycleWithNumber).not.toHaveBeenCalled();
  });

  it('si quedaron meses sin renovar, salta al período que contiene hoy', async () => {
    jest.setSystemTime(new Date('2027-03-05T01:00:00-03:00'));
    const { service, prisma, cycleNumberingService } = buildService();
    prisma.customer_subscription.findMany.mockResolvedValue([
      subscription('2026-12-19'),
    ]);

    await service.renewExpiredCycles();

    expect(cycleNumberingService.createCycleWithNumber).toHaveBeenCalledWith(
      123,
      expect.objectContaining({
        cycle_start: baDate('2027-02-20'),
        cycle_end: baDate('2027-03-19'),
      }),
    );
  });

  it('ARREARS con payment_due_day vence ese día del mes siguiente al fin del ciclo', async () => {
    jest.setSystemTime(new Date('2026-12-20T01:00:00-03:00'));
    const { service, prisma, cycleNumberingService } = buildService();
    prisma.customer_subscription.findMany.mockResolvedValue([
      subscription('2026-12-19', { payment_mode: 'ARREARS', payment_due_day: 10 }),
    ]);

    await service.renewExpiredCycles();

    const [, data] = cycleNumberingService.createCycleWithNumber.mock.calls[0];
    expect(data.cycle_end).toEqual(baDate('2027-01-19'));
    expect(data.payment_due_date.getFullYear()).toBe(2027);
    expect(data.payment_due_date.getMonth()).toBe(1); // febrero
    expect(data.payment_due_date.getDate()).toBe(10);
  });
});
