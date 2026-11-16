import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountMovementSide,
  CustomerAccountAdjustmentKind,
  Prisma,
} from '@prisma/client';
import { CustomerAccountsService } from './customer-accounts.service';
import { AccountMovementConcept } from './account-statement';

describe('CustomerAccountsService', () => {
  let prisma: any;
  let sources: { collect: jest.Mock };
  let service: CustomerAccountsService;

  beforeEach(() => {
    prisma = {
      person: {
        findUnique: jest.fn().mockResolvedValue({
          person_id: 10,
          name: 'Ana',
          phone: '3624111111',
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      customer_account_adjustment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        createMany: jest
          .fn()
          .mockImplementation(({ data }) => ({ count: data.length })),
        updateMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((fn: (tx: any) => unknown) => fn(prisma)),
    };
    sources = { collect: jest.fn().mockResolvedValue([]) };
    service = new CustomerAccountsService(prisma, sources as any);
  });

  describe('getAccount', () => {
    it('combina documentos y ajustes y expone debe/haber', async () => {
      sources.collect.mockResolvedValue([
        {
          key: 'ORDER-1',
          date: '2026-11-01',
          at: new Date('2026-11-01T12:00:00Z'),
          side: AccountMovementSide.DEBIT,
          concept: AccountMovementConcept.ORDER,
          reference_id: 1,
          description: 'Pedido #1',
          amount: new Prisma.Decimal(1000),
          payment_method: null,
        },
      ]);
      prisma.customer_account_adjustment.findMany.mockResolvedValue([
        {
          adjustment_id: 3,
          kind: CustomerAccountAdjustmentKind.OPENING_BALANCE,
          side: AccountMovementSide.DEBIT,
          amount: new Prisma.Decimal(5000),
          movement_date: new Date('2026-10-31T00:00:00.000Z'),
          description: 'Saldo inicial',
        },
      ]);

      const result = await service.getAccount(10, {});

      expect(prisma.customer_account_adjustment.findMany).toHaveBeenCalledWith({
        where: { customer_id: 10, is_active: true },
      });
      expect(result.summary).toMatchObject({
        balance: '6000.00',
        debt: '6000.00',
        credit: '0.00',
      });
      expect(result.movements.data).toEqual([
        expect.objectContaining({
          key: 'ADJUSTMENT-3',
          concept: AccountMovementConcept.OPENING_BALANCE,
          debit: '5000.00',
          credit: null,
          balance: '5000.00',
        }),
        expect.objectContaining({ key: 'ORDER-1', balance: '6000.00' }),
      ]);
    });

    it('informa saldo a favor cuando los pagos superan la deuda', async () => {
      sources.collect.mockResolvedValue([
        {
          key: 'PAYMENT-1',
          date: '2026-11-01',
          at: new Date('2026-11-01T12:00:00Z'),
          side: AccountMovementSide.CREDIT,
          concept: AccountMovementConcept.PAYMENT,
          reference_id: 1,
          description: 'Pago',
          amount: new Prisma.Decimal(300),
          payment_method: 'Efectivo',
        },
      ]);
      const result = await service.getAccount(10, {});
      expect(result.summary).toMatchObject({
        balance: '-300.00',
        debt: '0.00',
        credit: '300.00',
        last_payment_date: '2026-11-01',
      });
    });

    it('rechaza clientes inexistentes y períodos invertidos', async () => {
      prisma.person.findUnique.mockResolvedValue(null);
      await expect(service.getAccount(99, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(
        service.getAccount(10, { from: '2026-12-01', to: '2026-11-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('voidAdjustment', () => {
    it('distingue ajuste inexistente de ya anulado', async () => {
      prisma.customer_account_adjustment.updateMany.mockResolvedValue({
        count: 0,
      });
      prisma.customer_account_adjustment.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.voidAdjustment(1, { reason: 'x' }, 7),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.customer_account_adjustment.findUnique.mockResolvedValueOnce({
        adjustment_id: 1,
      });
      await expect(
        service.voidAdjustment(1, { reason: 'x' }, 7),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('importOpeningBalances', () => {
    const base = {
      source_reference: 'deuda.xlsx',
      movement_date: '2026-11-15',
    };

    beforeEach(() => {
      prisma.person.findMany.mockResolvedValue([
        { person_id: 10 },
        { person_id: 11 },
      ]);
      prisma.$queryRaw.mockResolvedValue([
        { person_id: 20, digits: '3624000020' },
        { person_id: 21, digits: '3624000099' },
        { person_id: 22, digits: '3624000099' },
      ]);
    });

    it('por defecto solo valida y no guarda', async () => {
      const result = await service.importOpeningBalances(
        {
          ...base,
          rows: [
            { customer_id: 10, amount: 1500 },
            { phone: '362 400-0020', amount: -200 },
            { customer_id: 11, amount: 0 },
          ],
        },
        7,
      );

      expect(result).toMatchObject({
        dry_run: true,
        total_rows: 3,
        valid_rows: 2,
        skipped_zero_rows: 1,
        total_debit: '1500.00',
        total_credit: '200.00',
        created: 0,
        errors: [],
      });
      expect(
        prisma.customer_account_adjustment.createMany,
      ).not.toHaveBeenCalled();
    });

    it('reporta cada fila con problemas', async () => {
      prisma.customer_account_adjustment.findMany.mockResolvedValue([
        { customer_id: 11, adjustment_id: 40 },
      ]);

      const result = await service.importOpeningBalances(
        {
          ...base,
          rows: [
            { row: 2, amount: 100 },
            { row: 3, customer_id: 99, amount: 100 },
            { row: 4, phone: '3624000099', amount: 100 },
            { row: 5, phone: '3624000000', amount: 100 },
            { row: 6, customer_id: 10, amount: 100 },
            { row: 7, customer_id: 10, amount: 50 },
            { row: 8, customer_id: 11, amount: 70 },
          ],
        },
        7,
      );

      expect(result.errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 7, 8]);
      expect(result.errors[2].message).toContain('varios clientes');
      expect(result.errors[5].message).toContain('ya tiene saldo inicial');
      expect(result.valid_rows).toBe(0);
    });

    it('sin dry_run y con errores no guarda nada', async () => {
      await expect(
        service.importOpeningBalances(
          { ...base, dry_run: false, rows: [{ customer_id: 99, amount: 100 }] },
          7,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        prisma.customer_account_adjustment.createMany,
      ).not.toHaveBeenCalled();
    });

    it('guarda deuda como DEBIT y saldo a favor como CREDIT', async () => {
      const result = await service.importOpeningBalances(
        {
          ...base,
          dry_run: false,
          rows: [
            { customer_id: 10, amount: 1500 },
            { phone: '3624000020', amount: -200, description: 'A favor' },
          ],
        },
        7,
      );

      expect(result.created).toBe(2);
      const { data } =
        prisma.customer_account_adjustment.createMany.mock.calls[0][0];
      expect(data).toEqual([
        expect.objectContaining({
          customer_id: 10,
          kind: CustomerAccountAdjustmentKind.OPENING_BALANCE,
          side: AccountMovementSide.DEBIT,
          description: 'Saldo inicial (deuda.xlsx)',
          source_reference: 'deuda.xlsx',
          created_by: 7,
        }),
        expect.objectContaining({
          customer_id: 20,
          side: AccountMovementSide.CREDIT,
          description: 'A favor',
        }),
      ]);
      expect(data[0].amount.toFixed(2)).toBe('1500.00');
      expect(data[1].amount.toFixed(2)).toBe('200.00');
    });
  });
});
