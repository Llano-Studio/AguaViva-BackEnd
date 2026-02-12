jest.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClientMock {},
  SubscriptionStatus: { ACTIVE: 'ACTIVE' },
}));

import { SubscriptionCycleRenewalService } from './subscription-cycle-renewal.service';

describe('SubscriptionCycleRenewalService', () => {
  const buildService = () => {
    const cycleNumberingService = {
      createCycleWithNumber: jest.fn(),
    } as any;
    const cycleCalculatorService = {
      calculateAndUpdateCycleAmount: jest.fn(),
    } as any;

    const service = new SubscriptionCycleRenewalService(
      cycleNumberingService,
      cycleCalculatorService,
    ) as any;

    service.checkAndApplyLateFees = jest.fn();
    service.subscription_cycle = {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    };
    service.subscription_cycle_detail = {
      create: jest.fn(),
    };

    return { service, cycleNumberingService, cycleCalculatorService };
  };

  it('consulta ciclos vencidos con distinct y no duplica creación por suscripción', async () => {
    const { service, cycleNumberingService } = buildService();
    const subscription = {
      subscription_id: 123,
      subscription_plan: { subscription_plan_product: [] },
    };

    service.subscription_cycle.findMany.mockResolvedValue([
      { customer_subscription: subscription },
    ]);
    service.subscription_cycle.findFirst.mockResolvedValue(null);
    cycleNumberingService.createCycleWithNumber.mockResolvedValue({
      cycle_id: 1,
    });

    await service.renewExpiredCycles();

    expect(service.subscription_cycle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ['subscription_id'],
        orderBy: { cycle_end: 'desc' },
      }),
    );
    expect(cycleNumberingService.createCycleWithNumber).toHaveBeenCalledTimes(
      1,
    );
  });

  it('no crea ciclo si ya existe uno futuro desde hoy', async () => {
    const { service, cycleNumberingService } = buildService();
    const subscription = {
      subscription_id: 123,
      subscription_plan: { subscription_plan_product: [] },
    };

    service.subscription_cycle.findMany.mockResolvedValue([
      { customer_subscription: subscription },
    ]);
    service.subscription_cycle.findFirst.mockResolvedValue({
      cycle_id: 999,
      cycle_start: new Date(),
      cycle_end: new Date(),
    });

    await service.renewExpiredCycles();

    expect(cycleNumberingService.createCycleWithNumber).not.toHaveBeenCalled();
  });
});
