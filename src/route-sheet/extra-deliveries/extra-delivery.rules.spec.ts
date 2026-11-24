import {
  pickTargetRouteSheet,
  splitForReoptimization,
} from './extra-delivery.rules';

const stop = (id: number, status: string) => ({
  route_sheet_detail_id: id,
  delivery_status: status,
});

describe('pickTargetRouteSheet', () => {
  it('sin candidatas devuelve null', () => {
    expect(pickTargetRouteSheet([])).toBeNull();
  });

  it('con varias, elige la de menor ID sin importar el orden', () => {
    expect(
      pickTargetRouteSheet([
        { route_sheet_id: 30 },
        { route_sheet_id: 12 },
        { route_sheet_id: 25 },
      ]),
    ).toEqual({ route_sheet_id: 12 });
  });
});

describe('splitForReoptimization', () => {
  it('deja fijas las resueltas y la actual, y reordena el resto', () => {
    const result = splitForReoptimization([
      stop(1, 'DELIVERED'),
      stop(2, 'FAILED'),
      stop(3, 'PENDING'), // actual
      stop(4, 'PENDING'),
      stop(5, 'PENDING'),
    ]);
    expect(result.fixed.map((s) => s.route_sheet_detail_id)).toEqual([1, 2, 3]);
    expect(result.anchor?.route_sheet_detail_id).toBe(3);
    expect(result.reorderable.map((s) => s.route_sheet_detail_id)).toEqual([
      4, 5,
    ]);
  });

  it('una visita sin venta sigue siendo la parada actual', () => {
    const result = splitForReoptimization([
      stop(1, 'DELIVERED'),
      stop(2, 'VISITED'),
      stop(3, 'PENDING'),
    ]);
    expect(result.anchor?.route_sheet_detail_id).toBe(2);
    expect(result.reorderable.map((s) => s.route_sheet_detail_id)).toEqual([3]);
  });

  it('las resueltas posteriores a la actual quedan fijas y no se reordenan', () => {
    const result = splitForReoptimization([
      stop(1, 'PENDING'),
      stop(2, 'PENDING'),
      stop(3, 'SKIPPED'),
      stop(4, 'PENDING'),
    ]);
    expect(result.fixed.map((s) => s.route_sheet_detail_id)).toEqual([1, 3]);
    expect(result.reorderable.map((s) => s.route_sheet_detail_id)).toEqual([
      2, 4,
    ]);
  });

  it('con todo resuelto no hay nada para reordenar', () => {
    const result = splitForReoptimization([
      stop(1, 'DELIVERED'),
      stop(2, 'SKIPPED'),
    ]);
    expect(result.anchor).toBeNull();
    expect(result.reorderable).toEqual([]);
    expect(result.fixed).toHaveLength(2);
  });
});
