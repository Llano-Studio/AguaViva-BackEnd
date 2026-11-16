import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DriverCreditService } from './driver-credit.service';
import { DriverAccountMovementType } from '../route-reconciliation/dto';

const d = (value: string | number) => new Prisma.Decimal(value);

function charge(overrides: Record<string, unknown> = {}) {
  return {
    charge_id: 12,
    driver_id: 7,
    customer_id: 5885,
    route_sheet_id: 345,
    route_sheet_detail_id: 1002,
    payment_transaction_id: 7001,
    amount: d(100000),
    settled_amount: d(0),
    due_date: new Date('2026-12-10T00:00:00.000Z'),
    interest_rate: d('0.2000'),
    interest_base: null,
    interest_amount: null,
    interest_applied_at: null,
    status: 'OPEN',
    created_at: new Date('2026-11-16T15:00:00.000Z'),
    ...overrides,
  };
}

describe('DriverCreditService', () => {
  let prisma: any;
  let service: DriverCreditService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 7 }) },
      driver_credit_charge: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { interest_amount: null } }),
      },
      driver_credit_allocation: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        create: jest.fn(),
      },
      driver_account_movement: {
        create: jest.fn().mockResolvedValue({ movement_id: 88 }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };
    service = new DriverCreditService(prisma);
  });

  describe('createCharge', () => {
    it('vence el 10 del mes siguiente y suma la deuda al chofer', async () => {
      await service.createCharge(prisma, {
        driverId: 7,
        customerId: 5885,
        routeSheetId: 345,
        detailId: 1002,
        transactionId: 7001,
        amount: d(100000),
        chargedAt: new Date('2026-11-16T15:00:00.000Z'),
        reference: 'RS-345-D1002',
      });

      const data = prisma.driver_credit_charge.create.mock.calls[0][0].data;
      expect(data.due_date.toISOString()).toBe('2026-12-10T00:00:00.000Z');
      expect(data.interest_rate).toBe('0.2000');
      expect(prisma.driver_account_movement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          movement_type: DriverAccountMovementType.DRIVER_CREDIT,
          amount: '100000.00',
          origin_key: 'DRIVER_CREDIT:7001',
        }),
      });
    });
  });

  describe('applyDueInterest', () => {
    it('cobra el 20% sobre lo impago al vencimiento, una sola vez', async () => {
      prisma.driver_credit_charge.findMany.mockResolvedValue([
        charge({ settled_amount: d(30000) }),
      ]);
      // 30.000 se pagaron antes del vencimiento.
      prisma.driver_credit_allocation.aggregate.mockResolvedValue({
        _sum: { amount: d(30000) },
      });

      const result = await service.applyDueInterest(undefined, '2026-12-11');

      expect(result).toEqual({
        date: '2026-12-11',
        applied: 1,
        total_interest: '14000.00',
      });
      expect(prisma.driver_credit_charge.updateMany).toHaveBeenCalledWith({
        where: { charge_id: 12, interest_applied_at: null },
        data: expect.objectContaining({
          interest_base: '70000.00',
          interest_amount: '14000.00',
          status: 'OPEN',
        }),
      });
      expect(prisma.driver_account_movement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          movement_type: DriverAccountMovementType.DRIVER_CREDIT_INTEREST,
          amount: '14000.00',
          origin_key: 'DRIVER_CREDIT_INTEREST:12',
        }),
      });
    });

    it('no aplica nada el mismo día del vencimiento', async () => {
      prisma.driver_credit_charge.findMany.mockResolvedValue([charge()]);
      const result = await service.applyDueInterest(undefined, '2026-12-10');
      expect(result.applied).toBe(0);
      expect(prisma.driver_credit_charge.updateMany).not.toHaveBeenCalled();
    });

    it('si otro proceso ya lo aplicó no duplica el movimiento', async () => {
      prisma.driver_credit_charge.findMany.mockResolvedValue([charge()]);
      prisma.driver_credit_charge.updateMany.mockResolvedValue({ count: 0 });
      const result = await service.applyDueInterest(undefined, '2026-12-11');
      expect(result.applied).toBe(0);
      expect(prisma.driver_account_movement.create).not.toHaveBeenCalled();
    });
  });

  describe('registerPayment', () => {
    it('rechaza pagos mayores a la deuda', async () => {
      prisma.driver_credit_charge.findMany
        .mockResolvedValueOnce([]) // interés vencido
        .mockResolvedValueOnce([charge()]);
      await expect(
        service.registerPayment(3, 7, {
          amount: 150000,
          idempotency_key: 'p-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.driver_account_movement.create).not.toHaveBeenCalled();
    });

    it('imputa el pago y salda el cargo', async () => {
      prisma.driver_credit_charge.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([charge()])
        .mockResolvedValue([]);

      const result = await service.registerPayment(3, 7, {
        amount: 100000,
        idempotency_key: 'p-1',
      });

      expect(result.allocations).toEqual([
        { charge_id: 12, amount: '100000.00' },
      ]);
      expect(prisma.driver_account_movement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          movement_type: DriverAccountMovementType.DRIVER_CREDIT_PAYMENT,
          amount: '-100000.00',
          origin_key: 'DRIVER_CREDIT_PAYMENT:7:p-1',
        }),
      });
      expect(prisma.driver_credit_charge.update).toHaveBeenCalledWith({
        where: { charge_id: 12 },
        data: { settled_amount: '100000.00', status: 'SETTLED' },
      });
    });

    it('con la misma clave y otro monto se rechaza', async () => {
      prisma.driver_account_movement.findUnique.mockResolvedValue({
        movement_id: 88,
        amount: d(-50000),
        allocations: [],
      });
      await expect(
        service.registerPayment(3, 7, {
          amount: 60000,
          idempotency_key: 'p-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
