import { ConflictException } from '@nestjs/common';
import { Prisma, RouteSheetExecutionStatus } from '@prisma/client';
import { RouteReconciliationService } from './route-reconciliation.service';
import {
  DriverAccountMovementType,
  ReconciliationStatus,
} from './dto';

const DRIVER_ID = 7;
const ROUTE_SHEET_ID = 345;

function ownedSheet(
  statuses: string[],
  overrides: Record<string, unknown> = {},
) {
  return {
    route_sheet_id: ROUTE_SHEET_ID,
    driver_id: DRIVER_ID,
    delivery_date: new Date('2026-10-20T00:00:00.000Z'),
    execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
    reconciliation_at: null,
    route_sheet_detail: statuses.map((status, index) => ({
      route_sheet_detail_id: 1000 + index,
      delivery_status: status,
    })),
    ...overrides,
  };
}

function reconciliationRow(overrides: Record<string, unknown> = {}) {
  return {
    reconciliation_id: 501,
    route_sheet_id: ROUTE_SHEET_ID,
    driver_id: DRIVER_ID,
    status: ReconciliationStatus.CONFIRMED,
    total_collected: new Prisma.Decimal('1500.00'),
    cash_to_render: new Prisma.Decimal('1000.00'),
    electronic_total: new Prisma.Decimal('500.00'),
    collections_by_method: [
      { payment_method: 'EFECTIVO', amount: '1000.00' },
      { payment_method: 'TRANSFERENCIA', amount: '500.00' },
    ],
    product_summary: [],
    differences: [],
    version: 'v1',
    signature_path: null,
    idempotency_key: 'key-1',
    notes: null,
    confirmed_at: new Date('2026-10-20T18:30:00.000Z'),
    received_at: null,
    received_by: null,
    created_at: new Date('2026-10-20T18:30:00.000Z'),
    driver: { id: DRIVER_ID, name: 'Juan Pérez' },
    ...overrides,
  };
}

describe('RouteReconciliationService', () => {
  let service: RouteReconciliationService;
  let prisma: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      route_reconciliation: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      driver_account_movement: { create: jest.fn().mockResolvedValue({}) },
      route_sheet: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      route_sheet: { findFirst: jest.fn() },
      route_reconciliation: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      payment_transaction: { findMany: jest.fn().mockResolvedValue([]) },
      vehicle_route_inventory: { findMany: jest.fn().mockResolvedValue([]) },
      inventory_transaction: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      driver_account_movement: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      $transaction: jest.fn((fn: (client: any) => Promise<unknown>) => fn(tx)),
    };
    service = new RouteReconciliationService(prisma);
  });

  describe('previewForDriver', () => {
    it('consolida cobros por método y calcula el efectivo a rendir', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(ownedSheet(['PENDING']));
      prisma.payment_transaction.findMany.mockResolvedValue([
        {
          transaction_amount: new Prisma.Decimal('1000.00'),
          payment_method: { code: 'EFECTIVO' },
        },
        {
          transaction_amount: new Prisma.Decimal('500.00'),
          payment_method: { code: 'TRANSFERENCIA' },
        },
      ]);

      const preview = await service.previewForDriver(
        DRIVER_ID,
        ROUTE_SHEET_ID,
      );

      expect(preview.totals.cash_to_render).toBe('1000.00');
      expect(preview.totals.electronic_total).toBe('500.00');
      expect(preview.totals.total_collected).toBe('1500.00');
      expect(preview.collections).toEqual([
        { payment_method: 'EFECTIVO', amount: '1000.00' },
        { payment_method: 'TRANSFERENCIA', amount: '500.00' },
      ]);
      expect(preview.pending_deliveries).toBe(1);
      expect(preview.can_confirm).toBe(false);
      expect(preview.already_reconciled).toBe(false);
    });

    it('resume por producto: cargado menos entregado menos devuelto', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(
        ownedSheet(['DELIVERED']),
      );
      prisma.vehicle_route_inventory.findMany.mockResolvedValue([
        { product_id: 1, product: { description: 'Bidón 20L' } },
      ]);
      prisma.inventory_transaction.findMany.mockResolvedValue([
        { product_id: 1, quantity: 10, transaction_type: 'LOAD' },
        { product_id: 1, quantity: -4, transaction_type: 'DELIVERY' },
        { product_id: 1, quantity: 1, transaction_type: 'RETURN' },
      ]);

      const preview = await service.previewForDriver(
        DRIVER_ID,
        ROUTE_SHEET_ID,
      );

      expect(preview.products).toEqual([
        {
          product_id: 1,
          description: 'Bidón 20L',
          loaded_quantity: 10,
          delivered_quantity: 4,
          returned_quantity: 1,
          expected_remaining: 5,
          counted_quantity: null,
          difference_quantity: null,
        },
      ]);
      expect(preview.can_confirm).toBe(true);
    });
  });

  describe('confirmByDriver', () => {
    it('rechaza la confirmación si quedan paradas sin resolver', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(
        ownedSheet(['DELIVERED', 'PENDING']),
      );

      await expect(
        service.confirmByDriver(DRIVER_ID, ROUTE_SHEET_ID, {
          idempotency_key: 'key-1',
          version: 'v1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza la confirmación si la versión quedó obsoleta', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(
        ownedSheet(['DELIVERED']),
      );

      await expect(
        service.confirmByDriver(DRIVER_ID, ROUTE_SHEET_ID, {
          idempotency_key: 'key-1',
          version: 'obsoleta',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('crea el snapshot, registra la deuda y cierra la hoja', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(
        ownedSheet(['DELIVERED', 'SKIPPED']),
      );
      prisma.payment_transaction.findMany.mockResolvedValue([
        {
          transaction_amount: new Prisma.Decimal('1000.00'),
          payment_method: { code: 'EFECTIVO' },
        },
      ]);
      tx.route_reconciliation.create.mockResolvedValue(reconciliationRow());

      const preview = await service.previewForDriver(
        DRIVER_ID,
        ROUTE_SHEET_ID,
      );
      const result = await service.confirmByDriver(
        DRIVER_ID,
        ROUTE_SHEET_ID,
        { idempotency_key: 'key-1', version: preview.version },
      );

      expect(result.idempotent_replay).toBe(false);
      expect(tx.driver_account_movement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          movement_type: DriverAccountMovementType.CASH_COLLECTED,
          amount: '1000.00',
          origin_key: `RECONCILIATION:${ROUTE_SHEET_ID}`,
        }),
      });
      expect(tx.route_sheet.update).toHaveBeenCalledWith({
        where: { route_sheet_id: ROUTE_SHEET_ID },
        data: expect.objectContaining({
          execution_status: RouteSheetExecutionStatus.CLOSED,
        }),
      });
    });

    it('es idempotente: la misma clave devuelve la rendición ya registrada', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(
        ownedSheet(['DELIVERED']),
      );
      prisma.route_reconciliation.findUnique.mockResolvedValue(
        reconciliationRow({ idempotency_key: 'key-1' }),
      );

      const result = await service.confirmByDriver(
        DRIVER_ID,
        ROUTE_SHEET_ID,
        { idempotency_key: 'key-1', version: 'v1' },
      );

      expect(result.idempotent_replay).toBe(true);
      expect(tx.route_reconciliation.create).not.toHaveBeenCalled();
    });

    it('registra el conteo físico y expone las diferencias', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(
        ownedSheet(['DELIVERED']),
      );
      prisma.vehicle_route_inventory.findMany.mockResolvedValue([
        { product_id: 1, product: { description: 'Bidón 20L' } },
      ]);
      prisma.inventory_transaction.findMany.mockResolvedValue([
        { product_id: 1, quantity: 10, transaction_type: 'LOAD' },
      ]);
      tx.route_reconciliation.create.mockResolvedValue(reconciliationRow());

      const preview = await service.previewForDriver(
        DRIVER_ID,
        ROUTE_SHEET_ID,
      );
      await service.confirmByDriver(DRIVER_ID, ROUTE_SHEET_ID, {
        idempotency_key: 'key-1',
        version: preview.version,
        counted_items: [{ product_id: 1, counted_quantity: 8 }],
      });

      const created = tx.route_reconciliation.create.mock.calls[0][0].data;
      expect(created.differences).toEqual([
        {
          product_id: 1,
          description: 'Bidón 20L',
          expected_quantity: 10,
          counted_quantity: 8,
          difference: -2,
        },
      ]);
    });

    it('no abre deuda cuando no hay efectivo a rendir', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(
        ownedSheet(['DELIVERED']),
      );
      tx.route_reconciliation.create.mockResolvedValue(
        reconciliationRow({
          cash_to_render: new Prisma.Decimal('0.00'),
          status: ReconciliationStatus.CASH_RECEIVED,
        }),
      );

      const preview = await service.previewForDriver(
        DRIVER_ID,
        ROUTE_SHEET_ID,
      );
      await service.confirmByDriver(DRIVER_ID, ROUTE_SHEET_ID, {
        idempotency_key: 'key-1',
        version: preview.version,
      });

      expect(tx.driver_account_movement.create).not.toHaveBeenCalled();
      const created = tx.route_reconciliation.create.mock.calls[0][0].data;
      expect(created.status).toBe(ReconciliationStatus.CASH_RECEIVED);
    });
  });

  describe('receiveCash', () => {
    it('rechaza recibir más que el efectivo pendiente', async () => {
      prisma.route_reconciliation.findUnique.mockResolvedValue(
        reconciliationRow({ cash_to_render: new Prisma.Decimal('1000.00') }),
      );
      prisma.driver_account_movement.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      await expect(
        service.receiveCash(1, 501, {
          amount: 1500,
          idempotency_key: 'rc-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('marca la rendición como cobrada al completar el efectivo', async () => {
      prisma.route_reconciliation.findUnique.mockResolvedValue(
        reconciliationRow({ cash_to_render: new Prisma.Decimal('1000.00') }),
      );
      prisma.driver_account_movement.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      await service.receiveCash(1, 501, {
        amount: 1000,
        idempotency_key: 'rc-1',
      });

      expect(tx.driver_account_movement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          movement_type: DriverAccountMovementType.CASH_RENDERED,
          amount: '-1000.00',
          origin_key: 'CASH_RECEIVED:501:rc-1',
        }),
      });
      expect(tx.route_reconciliation.update).toHaveBeenCalledWith({
        where: { reconciliation_id: 501 },
        data: expect.objectContaining({
          status: ReconciliationStatus.CASH_RECEIVED,
        }),
      });
    });
  });

  describe('getDriverAccount', () => {
    it('reconstruye el saldo a partir de los movimientos', async () => {
      prisma.driver_account_movement.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('1500.00') } })
        .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal('-500.00') } });
      prisma.driver_account_movement.findMany.mockResolvedValue([
        {
          movement_id: 2,
          movement_type: DriverAccountMovementType.CASH_RENDERED,
          amount: new Prisma.Decimal('-500.00'),
          route_sheet_id: ROUTE_SHEET_ID,
          reconciliation_id: 501,
          reference: `RS-${ROUTE_SHEET_ID}`,
          notes: null,
          created_at: new Date('2026-10-20T19:00:00.000Z'),
        },
      ]);

      const account = await service.getDriverAccount(DRIVER_ID, {});

      expect(account.balance).toBe('1000.00');
      expect(account.total_debit).toBe('1500.00');
      expect(account.total_credit).toBe('500.00');
      expect(account.movements[0].amount).toBe('-500.00');
    });
  });
});
