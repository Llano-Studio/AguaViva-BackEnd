import { ConfigService } from '@nestjs/config';
import { RouteOptimizationService } from './route-optimization.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RouteOptimizer,
  RouteOptimizerInput,
} from '../routing/route-optimizer.port';

const depot = { lat: -27.493444, lng: -58.943556 };

function detail(
  id: number,
  sequence: number,
  status: string,
  coordinates: { lat: number; lng: number } | null = null,
) {
  return {
    route_sheet_detail_id: id,
    route_sheet_id: 9,
    sequence_number: sequence,
    delivery_status: status,
    lat: coordinates?.lat ?? null,
    lng: coordinates?.lng ?? null,
    order_header: { customer: { address: `Calle ${id}` } },
    one_off_purchase: null,
    one_off_purchase_header: null,
  };
}

interface PrismaMock {
  route_sheet: { findUnique: jest.Mock };
  route_sheet_detail: { findMany: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
}

interface DetailUpdate {
  where: { route_sheet_detail_id: number };
  data: { sequence_number: number };
}

describe('RouteOptimizationService.reoptimizeAfterExtras', () => {
  let prisma: PrismaMock;
  let optimizer: { provider: 'mock'; is_simulated: true; optimize: jest.Mock };
  let service: RouteOptimizationService;

  const config = {
    get: (key: string) =>
      ({
        'app.routeOptimization.depot.lat': depot.lat,
        'app.routeOptimization.depot.lng': depot.lng,
        'app.routeOptimization.returnToDepot': true,
      })[key],
  } as unknown as ConfigService;

  beforeEach(() => {
    prisma = {
      route_sheet: { findUnique: jest.fn() },
      route_sheet_detail: { findMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((fn: (tx: PrismaMock) => unknown) => fn(prisma)),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    optimizer = { provider: 'mock', is_simulated: true, optimize: jest.fn() };
    service = new RouteOptimizationService(
      prisma as unknown as PrismaService,
      optimizer as unknown as RouteOptimizer,
      config,
    );
  });

  it('con la hoja planificada optimiza el recorrido completo', async () => {
    prisma.route_sheet.findUnique.mockResolvedValue({
      execution_status: 'PLANNED',
      is_active: true,
    });
    const full = jest.spyOn(service, 'optimizeRoute').mockResolvedValue({
      provider: 'mock',
    } as Awaited<ReturnType<RouteOptimizationService['optimizeRoute']>>);

    const outcome = await service.reoptimizeAfterExtras(9);

    expect(full).toHaveBeenCalledWith({ route_sheet_id: 9 });
    expect(outcome).toEqual({ mode: 'FULL', provider: 'mock' });
  });

  it('con la hoja cerrada no hace nada', async () => {
    prisma.route_sheet.findUnique.mockResolvedValue({
      execution_status: 'CLOSED',
      is_active: true,
    });

    expect(await service.reoptimizeAfterExtras(9)).toEqual({
      mode: 'NONE',
      reason: 'CLOSED',
    });
    expect(optimizer.optimize).not.toHaveBeenCalled();
  });

  it('en curso: no mueve lo hecho ni la parada actual y reordena el resto desde ahí', async () => {
    prisma.route_sheet.findUnique.mockResolvedValue({
      execution_status: 'IN_PROGRESS',
      is_active: true,
    });
    const current = { lat: -27.46, lng: -58.98 };
    const rows = [
      detail(101, 1, 'DELIVERED'),
      detail(102, 2, 'PENDING', current), // actual
      detail(103, 3, 'PENDING'),
      detail(104, 4, 'PENDING'),
      detail(105, 5, 'PENDING'), // extra recién agregado
    ];
    prisma.route_sheet_detail.findMany
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(
        rows.map((r) => ({
          route_sheet_detail_id: r.route_sheet_detail_id,
          delivery_status: r.delivery_status,
        })),
      );
    optimizer.optimize.mockImplementation((input: RouteOptimizerInput) =>
      Promise.resolve({
        provider: 'mock',
        stops: [105, 103, 104].map((id, index) => ({
          stop_id: id,
          sequence_number: index + 1,
          coordinates: depot,
          coordinate_source: 'SIMULATED',
        })),
        input,
      }),
    );

    const outcome = await service.reoptimizeAfterExtras(9);

    const [input] = optimizer.optimize.mock.calls[0] as [RouteOptimizerInput];
    expect(input.depot).toEqual(current);
    expect(input.end_point).toEqual(depot);
    expect(input.stops.map((s) => s.stop_id)).toEqual([103, 104, 105]);

    const updates = (
      prisma.route_sheet_detail.update.mock.calls as [DetailUpdate][]
    ).map(([args]) => [
      args.where.route_sheet_detail_id,
      args.data.sequence_number,
    ]);
    // 101 y 102 no cambian; el extra 105 pasa a ser la próxima.
    expect(updates).toEqual([
      [105, 3],
      [103, 4],
      [104, 5],
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(outcome).toEqual({
      mode: 'PENDING',
      provider: 'mock',
      reordered: 3,
    });
  });

  it('si el chofer avanzó mientras se calculaba, no pisa su avance', async () => {
    prisma.route_sheet.findUnique.mockResolvedValue({
      execution_status: 'IN_PROGRESS',
      is_active: true,
    });
    const rows = [
      detail(102, 1, 'PENDING'),
      detail(103, 2, 'PENDING'),
      detail(104, 3, 'PENDING'),
    ];
    const advanced = [
      { route_sheet_detail_id: 102, delivery_status: 'DELIVERED' },
      { route_sheet_detail_id: 103, delivery_status: 'PENDING' },
      { route_sheet_detail_id: 104, delivery_status: 'PENDING' },
    ];
    // Lectura para calcular, y relectura dentro de la transacción (dos intentos).
    prisma.route_sheet_detail.findMany
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(advanced)
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce(advanced);
    optimizer.optimize.mockResolvedValue({
      provider: 'mock',
      stops: [104, 103].map((id, index) => ({
        stop_id: id,
        sequence_number: index + 1,
        coordinates: depot,
        coordinate_source: 'SIMULATED',
      })),
    });

    const outcome = await service.reoptimizeAfterExtras(9);

    expect(outcome).toEqual({ mode: 'NONE', reason: 'CONCURRENT_CHANGES' });
    expect(prisma.route_sheet_detail.update).not.toHaveBeenCalled();
  });

  it('con una sola pendiente después de la actual no llama al optimizador', async () => {
    prisma.route_sheet.findUnique.mockResolvedValue({
      execution_status: 'PAUSED',
      is_active: true,
    });
    prisma.route_sheet_detail.findMany.mockResolvedValue([
      detail(102, 1, 'VISITED'),
      detail(103, 2, 'PENDING'),
    ]);

    expect(await service.reoptimizeAfterExtras(9)).toEqual({
      mode: 'NONE',
      reason: 'NOTHING_TO_REORDER',
    });
    expect(optimizer.optimize).not.toHaveBeenCalled();
  });
});
