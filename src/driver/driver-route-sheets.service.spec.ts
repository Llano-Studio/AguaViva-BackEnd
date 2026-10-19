import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RouteSheetExecutionStatus, RouteSheetPauseReason } from '@prisma/client';
import { computeDeliveryLocks } from '../route-sheet/delivery-locks';
import {
  DriverRouteSheetsService,
  resolveStop,
} from './driver-route-sheets.service';
import { DriverStopType } from './dto';
import { nowBAYMD } from '../common/utils/date.utils';

const DRIVER_ID = 7;

function detail(id: number, status: string, sequence: number | null = id) {
  return {
    route_sheet_detail_id: id,
    sequence_number: sequence,
    delivery_status: status,
    delivery_time: '09:00-11:00',
    order_header: {
      order_id: id * 10,
      total_amount: new Prisma.Decimal(1500),
      paid_amount: new Prisma.Decimal(0),
      customer: {
        person_id: id * 100,
        name: `Cliente ${id}`,
        alias: null,
        address: 'Calle 123',
        phone: '3624000000',
      },
    },
  };
}

function sheetRow(overrides: Record<string, unknown> = {}) {
  return {
    route_sheet_id: 1,
    driver_id: DRIVER_ID,
    delivery_date: new Date(`${nowBAYMD()}T00:00:00.000Z`),
    execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
    started_at: new Date('2026-10-12T11:00:00.000Z'),
    closed_at: null,
    route_notes: null,
    vehicle: { vehicle_id: 1, code: 'CAM-01', name: 'Camión 1' },
    route_sheet_pause: [],
    route_sheet_detail: [
      detail(1, 'DELIVERED'),
      detail(2, 'PENDING'),
      detail(3, 'PENDING'),
    ],
    ...overrides,
  };
}

describe('computeDeliveryLocks', () => {
  it('habilita solo la primera entrega sin resolver cuando la hoja está en curso', () => {
    const result = computeDeliveryLocks(
      ['DELIVERED', 'SKIPPED', 'PENDING', 'PENDING'],
      RouteSheetExecutionStatus.IN_PROGRESS,
    );
    expect(result.currentIndex).toBe(2);
    expect(result.resolved).toEqual([true, true, false, false]);
  });

  it('no habilita ninguna entrega si la hoja no está en curso', () => {
    for (const status of [
      RouteSheetExecutionStatus.PLANNED,
      RouteSheetExecutionStatus.PAUSED,
      RouteSheetExecutionStatus.CLOSED,
    ]) {
      expect(computeDeliveryLocks(['PENDING'], status).currentIndex).toBeNull();
    }
  });

  it('no habilita ninguna entrega si todas están resueltas', () => {
    expect(
      computeDeliveryLocks(['DELIVERED', 'FAILED'], RouteSheetExecutionStatus.IN_PROGRESS)
        .currentIndex,
    ).toBeNull();
  });

  it('mantiene la parada visitada como actual hasta entregarla u omitirla', () => {
    const result = computeDeliveryLocks(
      ['DELIVERED', 'VISITED', 'PENDING'],
      RouteSheetExecutionStatus.IN_PROGRESS,
    );
    expect(result.currentIndex).toBe(1);
    expect(result.resolved).toEqual([true, false, false]);
  });
});

describe('resolveStop', () => {
  const person = {
    person_id: 5,
    name: 'Ana',
    alias: null,
    address: 'Domicilio 1',
    phone: '3624111111',
  };
  const empty = {
    order_header: null,
    one_off_purchase: null,
    one_off_purchase_header: null,
    cancellation_order: null,
    cycle_payment: null,
  };

  it('resuelve una compra única con su dirección de entrega', () => {
    const stop = resolveStop({
      ...empty,
      one_off_purchase_header: {
        purchase_header_id: 30,
        total_amount: new Prisma.Decimal(500),
        paid_amount: new Prisma.Decimal(0),
        delivery_address: 'Otra dirección',
        person,
      },
    } as any);
    expect(stop).toMatchObject({
      stop_type: DriverStopType.ONE_OFF,
      reference_id: 30,
      order_id: null,
      delivery_address: 'Otra dirección',
      customer: person,
    });
  });

  it('resuelve un retiro por cancelación de abono', () => {
    const stop = resolveStop({
      ...empty,
      cancellation_order: {
        cancellation_order_id: 8,
        customer_subscription: { person },
      },
    } as any);
    expect(stop).toMatchObject({
      stop_type: DriverStopType.CANCELLATION,
      reference_id: 8,
      total_amount: null,
      customer: person,
    });
  });

  it('resuelve una cobranza de ciclo con los montos del ciclo', () => {
    const stop = resolveStop({
      ...empty,
      cycle_payment: {
        payment_id: 12,
        subscription_cycle: {
          total_amount: new Prisma.Decimal(9000),
          paid_amount: new Prisma.Decimal(3000),
          customer_subscription: { person },
        },
      },
    } as any);
    expect(stop.stop_type).toBe(DriverStopType.COLLECTION);
    expect(stop.reference_id).toBe(12);
    expect(stop.total_amount?.toFixed(2)).toBe('9000.00');
    expect(stop.customer).toBe(person);
  });
});

describe('DriverRouteSheetsService', () => {
  let prisma: any;
  let tx: any;
  let service: DriverRouteSheetsService;

  beforeEach(() => {
    tx = {
      route_sheet: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      route_sheet_pause: {
        create: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      route_sheet: { findMany: jest.fn(), findFirst: jest.fn() },
      route_sheet_detail: { findFirst: jest.fn(), findMany: jest.fn() },
      payment_transaction: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((fn: (client: any) => Promise<unknown>) => fn(tx)),
    };
    service = new DriverRouteSheetsService(prisma);
  });

  /** findFirst: 1.ª llamada = hoja propia, 2.ª = otra hoja en curso, resto = detalle. */
  function mockFindFirst(owned: unknown, otherInProgress: unknown = null, detailRow = sheetRow()) {
    prisma.route_sheet.findFirst.mockImplementation(({ select, include, where }: any) => {
      if (include) return Promise.resolve(detailRow);
      if (where.route_sheet_id?.not !== undefined) return Promise.resolve(otherInProgress);
      return Promise.resolve(owned);
    });
  }

  describe('findForDriver', () => {
    it('filtra por el chofer y, para hoy, incluye hojas abiertas de días anteriores', async () => {
      prisma.route_sheet.findMany.mockResolvedValue([sheetRow()]);

      const [summary] = await service.findForDriver(DRIVER_ID, {});

      const { where } = prisma.route_sheet.findMany.mock.calls[0][0];
      expect(where.driver_id).toBe(DRIVER_ID);
      expect(where.OR).toHaveLength(2);
      expect(where.OR[1].execution_status.in).toEqual([
        RouteSheetExecutionStatus.IN_PROGRESS,
        RouteSheetExecutionStatus.PAUSED,
      ]);
      expect(summary.totals).toEqual({
        total: 3,
        pending: 2,
        delivered: 1,
        not_delivered: 0,
      });
      expect(summary.scheduled_start_time).toBe('09:00');
    });

    it('para otra fecha no agrega hojas abiertas de días anteriores', async () => {
      prisma.route_sheet.findMany.mockResolvedValue([]);
      await service.findForDriver(DRIVER_ID, { date: '2020-01-01' });
      const { where } = prisma.route_sheet.findMany.mock.calls[0][0];
      expect(where.OR).toEqual([{ delivery_date: new Date('2020-01-01T00:00:00.000Z') }]);
    });

    it('rechaza fechas inválidas', async () => {
      await expect(
        service.findForDriver(DRIVER_ID, { date: '2026-02-31' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('findOneForDriver', () => {
    it('marca la entrega actual y bloquea las siguientes', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(sheetRow());

      const result = await service.findOneForDriver(DRIVER_ID, 1);

      expect(prisma.route_sheet.findFirst.mock.calls[0][0].where).toMatchObject({
        route_sheet_id: 1,
        driver_id: DRIVER_ID,
      });
      expect(result.current_detail_id).toBe(2);
      expect(result.can_close).toBe(false);
      expect(
        result.deliveries.map((d) => [d.position, d.is_current, d.is_locked]),
      ).toEqual([
        [1, false, false],
        [2, true, false],
        [3, false, true],
      ]);
      expect(result.deliveries[1].total_amount).toBe('1500.00');
    });

    it('permite cerrar cuando todo está resuelto y la hoja sigue en curso', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(
        sheetRow({ route_sheet_detail: [detail(1, 'DELIVERED'), detail(2, 'FAILED')] }),
      );
      const result = await service.findOneForDriver(DRIVER_ID, 1);
      expect(result.can_close).toBe(true);
      expect(result.current_detail_id).toBeNull();
      expect(result.totals.not_delivered).toBe(1);
    });

    it('devuelve 404 si la hoja no es del chofer', async () => {
      prisma.route_sheet.findFirst.mockResolvedValue(null);
      await expect(service.findOneForDriver(DRIVER_ID, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('start', () => {
    const planned = {
      route_sheet_id: 1,
      execution_status: RouteSheetExecutionStatus.PLANNED,
      delivery_date: new Date(`${nowBAYMD()}T00:00:00.000Z`),
    };

    it('pasa la hoja a IN_PROGRESS', async () => {
      mockFindFirst(planned);

      await service.start(DRIVER_ID, 1);

      expect(tx.route_sheet.updateMany).toHaveBeenCalledWith({
        where: { route_sheet_id: 1, execution_status: RouteSheetExecutionStatus.PLANNED },
        data: {
          execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
          started_at: expect.any(Date),
        },
      });
    });

    it('rechaza si el chofer ya tiene otra hoja en curso', async () => {
      mockFindFirst(planned, { route_sheet_id: 2 });
      await expect(service.start(DRIVER_ID, 1)).rejects.toThrow(
        'Ya tenés la hoja de ruta 2 en curso',
      );
      expect(tx.route_sheet.updateMany).not.toHaveBeenCalled();
    });

    it('traduce la carrera del índice único (P2002) a un 409', async () => {
      mockFindFirst(planned);
      prisma.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.start(DRIVER_ID, 1)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rechaza hojas de fechas futuras', async () => {
      mockFindFirst({ ...planned, delivery_date: new Date('2999-01-01T00:00:00.000Z') });
      await expect(service.start(DRIVER_ID, 1)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si la hoja no está planificada', async () => {
      mockFindFirst({ ...planned, execution_status: RouteSheetExecutionStatus.CLOSED });
      await expect(service.start(DRIVER_ID, 1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza si otro request cambió el estado en el medio', async () => {
      mockFindFirst(planned);
      tx.route_sheet.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.start(DRIVER_ID, 1)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('pause / resume', () => {
    it('pausa una hoja en curso y registra el motivo', async () => {
      mockFindFirst({
        route_sheet_id: 1,
        execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
        delivery_date: new Date(),
      });

      await service.pause(DRIVER_ID, 1, {
        reason: RouteSheetPauseReason.VEHICLE_ISSUE,
        notes: '  pinchadura  ',
      });

      expect(tx.route_sheet.updateMany).toHaveBeenCalledWith({
        where: { route_sheet_id: 1, execution_status: RouteSheetExecutionStatus.IN_PROGRESS },
        data: { execution_status: RouteSheetExecutionStatus.PAUSED },
      });
      expect(tx.route_sheet_pause.create).toHaveBeenCalledWith({
        data: {
          route_sheet_id: 1,
          reason: RouteSheetPauseReason.VEHICLE_ISSUE,
          notes: 'pinchadura',
          paused_by: DRIVER_ID,
        },
      });
    });

    it('no pausa una hoja que no está en curso', async () => {
      mockFindFirst({
        route_sheet_id: 1,
        execution_status: RouteSheetExecutionStatus.PLANNED,
        delivery_date: new Date(),
      });
      await expect(
        service.pause(DRIVER_ID, 1, { reason: RouteSheetPauseReason.RESTOCK }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('reanuda y cierra la pausa abierta', async () => {
      mockFindFirst({
        route_sheet_id: 1,
        execution_status: RouteSheetExecutionStatus.PAUSED,
        delivery_date: new Date(),
      });

      await service.resume(DRIVER_ID, 1);

      expect(tx.route_sheet.updateMany).toHaveBeenCalledWith({
        where: { route_sheet_id: 1, execution_status: RouteSheetExecutionStatus.PAUSED },
        data: { execution_status: RouteSheetExecutionStatus.IN_PROGRESS },
      });
      expect(tx.route_sheet_pause.updateMany).toHaveBeenCalledWith({
        where: { route_sheet_id: 1, resumed_at: null },
        data: { resumed_at: expect.any(Date), resumed_by: DRIVER_ID },
      });
    });
  });

  describe('findDeliveryForDriver', () => {
    function deliveryRow(id = 2, status = 'PENDING') {
      return {
        route_sheet_detail_id: id,
        route_sheet_id: 1,
        order_id: 20,
        one_off_purchase_id: null,
        one_off_purchase_header_id: null,
        cancellation_order_id: null,
        cycle_payment_id: null,
        delivery_status: status,
        delivery_time: '09:00-11:00',
        comments: null,
        actual_arrival_time: null,
        order_header: {
          order_id: 20,
          order_type: 'CONTRACT_DELIVERY',
          status: 'READY_FOR_DELIVERY',
          payment_status: 'PENDING',
          order_date: new Date('2026-10-12T11:00:00.000Z'),
          total_amount: new Prisma.Decimal(1500),
          paid_amount: new Prisma.Decimal(500),
          notes: null,
          customer: {
            person_id: 200,
            name: 'Cliente 2',
            alias: null,
            address: 'Calle 123',
            phone: '3624000000',
            tax_id: '20-12345678-9',
            notes: null,
          },
          order_item: [
            {
              order_item_id: 9001,
              quantity: 2,
              unit_price: new Prisma.Decimal(750),
              subtotal: new Prisma.Decimal(1500),
              delivered_quantity: 0,
              returned_quantity: 0,
              product: { product_id: 4, description: 'Bidón 20L' },
            },
          ],
        },
        one_off_purchase: null,
        one_off_purchase_header: null,
        cancellation_order: null,
        cycle_payment: null,
      };
    }

    function mockDelivery(
      opts: {
        sheet?: unknown;
        detail?: unknown;
        siblings?: unknown[];
      } = {},
    ) {
      prisma.route_sheet.findFirst.mockResolvedValue(
        opts.sheet === undefined
          ? {
              route_sheet_id: 1,
              execution_status: RouteSheetExecutionStatus.IN_PROGRESS,
            }
          : opts.sheet,
      );
      prisma.route_sheet_detail.findFirst.mockResolvedValue(
        opts.detail === undefined ? deliveryRow() : opts.detail,
      );
      prisma.route_sheet_detail.findMany.mockResolvedValue(
        opts.siblings ?? [
          { route_sheet_detail_id: 1, delivery_status: 'DELIVERED' },
          { route_sheet_detail_id: 2, delivery_status: 'PENDING' },
          { route_sheet_detail_id: 3, delivery_status: 'PENDING' },
        ],
      );
      prisma.payment_transaction.findMany.mockResolvedValue([
        {
          transaction_id: 7001,
          transaction_date: new Date('2026-10-10T11:05:00.000Z'),
          transaction_amount: new Prisma.Decimal(500),
          document_number: 'A-1',
          receipt_number: null,
          payment_method: { code: 'EFECTIVO' },
        },
      ]);
    }

    it('devuelve cliente, productos, deuda, pagos previos y la parada actual', async () => {
      mockDelivery();

      const result = await service.findDeliveryForDriver(DRIVER_ID, 1, 2);

      expect(result.is_current).toBe(true);
      expect(result.is_resolved).toBe(false);
      expect(result.delivery_status).toBe('PENDING');
      expect(result.stop_type).toBe(DriverStopType.ORDER);
      expect(result.allowed_actions).toEqual(['VISIT', 'DELIVER', 'SKIP']);
      expect(result.order?.total_amount).toBe('1500.00');
      expect(result.order?.paid_amount).toBe('500.00');
      expect(result.order?.debt_amount).toBe('1000.00');
      expect(result.order?.items[0]).toMatchObject({
        product_description: 'Bidón 20L',
        quantity: 2,
        unit_price: '750.00',
        subtotal: '1500.00',
      });
      expect(result.customer.tax_id).toBe('20-12345678-9');
      expect(result.previous_payments[0]).toMatchObject({
        transaction_id: 7001,
        amount: '500.00',
        payment_method: 'EFECTIVO',
      });
      expect(result.credits).toEqual([]);
      expect(result.version).toMatch(/^[0-9a-f]{16}$/);
    });

    it('no habilita acciones si la parada no es la actual', async () => {
      mockDelivery({ detail: deliveryRow(3) });

      const result = await service.findDeliveryForDriver(DRIVER_ID, 1, 3);

      expect(result.is_current).toBe(false);
      expect(result.allowed_actions).toEqual([]);
    });

    it('no habilita acciones si la hoja no está en curso', async () => {
      mockDelivery({
        sheet: {
          route_sheet_id: 1,
          execution_status: RouteSheetExecutionStatus.PAUSED,
        },
      });

      const result = await service.findDeliveryForDriver(DRIVER_ID, 1, 2);

      expect(result.is_current).toBe(false);
      expect(result.allowed_actions).toEqual([]);
    });

    it('con la parada visitada sigue siendo la actual y solo permite entregar u omitir', async () => {
      mockDelivery({
        detail: deliveryRow(2, 'VISITED'),
        siblings: [
          { route_sheet_detail_id: 1, delivery_status: 'DELIVERED' },
          { route_sheet_detail_id: 2, delivery_status: 'VISITED' },
          { route_sheet_detail_id: 3, delivery_status: 'PENDING' },
        ],
      });

      const result = await service.findDeliveryForDriver(DRIVER_ID, 1, 2);

      expect(result.is_current).toBe(true);
      expect(result.allowed_actions).toEqual(['DELIVER', 'SKIP']);
    });

    it('resuelve una parada de compra única sin pagos previos', async () => {
      mockDelivery({
        detail: {
          ...deliveryRow(2),
          order_id: null,
          one_off_purchase_header_id: 30,
          order_header: null,
          one_off_purchase: null,
          one_off_purchase_header: {
            purchase_header_id: 30,
            total_amount: new Prisma.Decimal(500),
            paid_amount: new Prisma.Decimal(0),
            delivery_address: 'Otra dirección',
            person: {
              person_id: 300,
              name: 'Cliente único',
              alias: null,
              address: 'Base',
              phone: '3624222222',
              tax_id: null,
              notes: null,
            },
          },
        },
      });

      const result = await service.findDeliveryForDriver(DRIVER_ID, 1, 2);

      expect(result.stop_type).toBe(DriverStopType.ONE_OFF);
      expect(result.order).toBeNull();
      expect(result.previous_payments).toEqual([]);
      expect(prisma.payment_transaction.findMany).not.toHaveBeenCalled();
      expect(result.customer.address).toBe('Otra dirección');
    });

    it('devuelve 404 si la hoja no es del chofer', async () => {
      mockDelivery({ sheet: null });
      await expect(
        service.findDeliveryForDriver(DRIVER_ID, 99, 2),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devuelve 404 si la parada no existe en la hoja', async () => {
      mockDelivery({ detail: null });
      await expect(
        service.findDeliveryForDriver(DRIVER_ID, 1, 999),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
