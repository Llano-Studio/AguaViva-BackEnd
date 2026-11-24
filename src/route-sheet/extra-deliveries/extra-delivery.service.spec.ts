import { BadRequestException, ConflictException } from '@nestjs/common';
import { ExtraDeliveryService } from './extra-delivery.service';
import { RouteSheetService } from '../route-sheet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { nowBAYMD } from '../../common/utils/date.utils';

/** Fecha de Buenos Aires a N días de hoy, como la guarda una columna DATE. */
function baDate(offsetDays: number): Date {
  const date = new Date(`${nowBAYMD()}T15:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}

describe('ExtraDeliveryService', () => {
  let prisma: {
    order_header: { findUnique: jest.Mock };
    one_off_purchase_header?: { findUnique: jest.Mock };
    route_sheet_detail: { findFirst: jest.Mock };
    route_sheet: { findMany: jest.Mock };
  };
  let routeSheetService: { addDetailsIncremental: jest.Mock };
  let service: ExtraDeliveryService;

  const order = (overrides: Record<string, unknown> = {}) => ({
    order_id: 501,
    order_type: 'HYBRID',
    status: 'PENDING',
    order_date: baDate(0),
    scheduled_delivery_date: baDate(0),
    zone_id: null,
    customer: { zone_id: 4 },
    ...overrides,
  });

  /** Filtro con el que se buscaron las hojas candidatas. */
  const findManyWhere = (): Record<string, unknown> =>
    (
      prisma.route_sheet.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;

  beforeEach(() => {
    prisma = {
      order_header: { findUnique: jest.fn().mockResolvedValue(order()) },
      route_sheet_detail: { findFirst: jest.fn().mockResolvedValue(null) },
      route_sheet: {
        findMany: jest.fn().mockResolvedValue([
          { route_sheet_id: 77, execution_status: 'IN_PROGRESS' },
          { route_sheet_id: 70, execution_status: 'PLANNED' },
        ]),
      },
    };
    routeSheetService = { addDetailsIncremental: jest.fn() };
    service = new ExtraDeliveryService(
      prisma as unknown as PrismaService,
      routeSheetService as unknown as RouteSheetService,
    );
  });

  it('agrega el pedido a la hoja del móvil que cubre la zona del cliente', async () => {
    const outcome = await service.handleDeliveryCreated({
      kind: 'order',
      id: 501,
    });

    expect(outcome).toEqual({ status: 'ADDED', route_sheet_id: 70 });
    const today = new Date(`${nowBAYMD()}T00:00:00.000Z`);
    expect(findManyWhere()).toMatchObject({
      is_active: true,
      delivery_date: today,
      execution_status: { in: ['PLANNED', 'IN_PROGRESS', 'PAUSED'] },
      vehicle: { vehicle_zone: { some: { zone_id: 4, is_active: true } } },
    });
    expect(routeSheetService.addDetailsIncremental).toHaveBeenCalledWith(
      70,
      { details: [{ order_id: 501, order_type: 'HYBRID' }] },
      { source: 'ORDER_EVENT' },
    );
  });

  it('la zona del pedido tiene prioridad sobre la del cliente', async () => {
    prisma.order_header.findUnique.mockResolvedValue(order({ zone_id: 9 }));

    await service.handleDeliveryCreated({ kind: 'order', id: 501 });

    expect(findManyWhere()).toMatchObject({
      vehicle: { vehicle_zone: { some: { zone_id: 9, is_active: true } } },
    });
  });

  it('sin fecha programada usa la fecha de creación', async () => {
    prisma.order_header.findUnique.mockResolvedValue(
      order({ scheduled_delivery_date: null, order_date: baDate(0) }),
    );

    const outcome = await service.handleDeliveryCreated({
      kind: 'order',
      id: 501,
    });

    expect(outcome.status).toBe('ADDED');
  });

  it.each([
    ['NOT_FOUND', () => prisma.order_header.findUnique.mockResolvedValue(null)],
    [
      'NOT_DELIVERABLE',
      () =>
        prisma.order_header.findUnique.mockResolvedValue(
          order({ status: 'CANCELLED' }),
        ),
    ],
    [
      'PAST_DATE',
      () =>
        prisma.order_header.findUnique.mockResolvedValue(
          order({ scheduled_delivery_date: baDate(-1) }),
        ),
    ],
    [
      'NO_ZONE',
      () =>
        prisma.order_header.findUnique.mockResolvedValue(
          order({ customer: { zone_id: null } }),
        ),
    ],
    [
      'ALREADY_ASSIGNED',
      () =>
        prisma.route_sheet_detail.findFirst.mockResolvedValue({
          route_sheet_id: 77,
        }),
    ],
    ['NO_ROUTE_SHEET', () => prisma.route_sheet.findMany.mockResolvedValue([])],
  ])('no lo agrega: %s', async (reason, arrange) => {
    arrange();

    const outcome = await service.handleDeliveryCreated({
      kind: 'order',
      id: 501,
    });

    expect(outcome).toMatchObject({ status: 'IGNORED', reason });
    expect(routeSheetService.addDetailsIncremental).not.toHaveBeenCalled();
  });

  it('si ya lo tomó otra hoja en paralelo, lo ignora sin fallar', async () => {
    routeSheetService.addDetailsIncremental.mockRejectedValue(
      new ConflictException('ya asignada'),
    );

    const outcome = await service.handleDeliveryCreated({
      kind: 'order',
      id: 501,
    });

    expect(outcome).toEqual({
      status: 'IGNORED',
      reason: 'CONFLICT',
      route_sheet_id: 70,
    });
  });

  it('si la hoja no lo acepta (400), lo ignora sin fallar', async () => {
    routeSheetService.addDetailsIncremental.mockRejectedValue(
      new BadRequestException('estado no asignable'),
    );

    const outcome = await service.handleDeliveryCreated({
      kind: 'order',
      id: 501,
    });

    expect(outcome).toEqual({
      status: 'IGNORED',
      reason: 'REJECTED',
      route_sheet_id: 70,
    });
  });

  it('los demás errores se propagan', async () => {
    routeSheetService.addDetailsIncremental.mockRejectedValue(
      new Error('db caída'),
    );

    await expect(
      service.handleDeliveryCreated({ kind: 'order', id: 501 }),
    ).rejects.toThrow('db caída');
  });
});
