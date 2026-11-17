import { ConfigService } from '@nestjs/config';
import { MockRouteOptimizer } from './mock-route-optimizer.adapter';
import { GeoPoint, RouteOptimizerInput } from './route-optimizer.port';

describe('MockRouteOptimizer', () => {
  const configValues: Record<string, number> = {
    'app.routeOptimization.mockRadiusKm': 6,
    'app.routeOptimization.averageSpeedKmh': 30,
    'app.routeOptimization.serviceMinutesPerStop': 5,
    'app.routeOptimization.roadFactor': 1.3,
  };

  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  const depot: GeoPoint = { lat: -27.4514, lng: -58.9866 };

  const buildInput = (
    stops: RouteOptimizerInput['stops'],
  ): RouteOptimizerInput => ({
    route_sheet_id: 1,
    depot,
    end_point: null,
    stops,
  });

  it('devuelve el mismo resultado para la misma entrada', async () => {
    const input = buildInput([
      { stop_id: 1, address: 'Calle 1 al 100', coordinates: null },
      { stop_id: 2, address: 'Calle 2 al 200', coordinates: null },
      { stop_id: 3, address: 'Calle 3 al 300', coordinates: null },
    ]);

    const first = await new MockRouteOptimizer(configService).optimize(input);
    const second = await new MockRouteOptimizer(configService).optimize(input);

    expect(second.stops.map((s) => s.stop_id)).toEqual(
      first.stops.map((s) => s.stop_id),
    );
    expect(second.stops.map((s) => s.coordinates)).toEqual(
      first.stops.map((s) => s.coordinates),
    );
  });

  it('marca las coordenadas generadas como simuladas', async () => {
    const result = await new MockRouteOptimizer(configService).optimize(
      buildInput([
        { stop_id: 1, address: 'Calle 1 al 100', coordinates: null },
        { stop_id: 2, address: 'Calle 2 al 200', coordinates: null },
      ]),
    );

    expect(result.is_simulated).toBe(true);
    expect(result.provider).toBe('mock');
    expect(result.stops.every((s) => s.coordinate_source === 'SIMULATED')).toBe(
      true,
    );
  });

  it('genera coordenadas distintas para direcciones distintas', async () => {
    const result = await new MockRouteOptimizer(configService).optimize(
      buildInput([
        { stop_id: 1, address: 'Calle 1 al 100', coordinates: null },
        { stop_id: 2, address: 'Calle 2 al 200', coordinates: null },
      ]),
    );

    const [a, b] = result.stops;
    expect(`${a.coordinates.lat},${a.coordinates.lng}`).not.toEqual(
      `${b.coordinates.lat},${b.coordinates.lng}`,
    );
  });

  it('trata como equivalentes las direcciones con distinta capitalización y tildes', async () => {
    const plain = await new MockRouteOptimizer(configService).optimize(
      buildInput([
        { stop_id: 1, address: 'av. san martin 1200', coordinates: null },
      ]),
    );
    const accented = await new MockRouteOptimizer(configService).optimize(
      buildInput([
        { stop_id: 1, address: 'AV.  San Martín 1200', coordinates: null },
      ]),
    );

    expect(accented.stops[0].coordinates).toEqual(plain.stops[0].coordinates);
  });

  it('conserva las coordenadas verificadas y las marca como DATABASE', async () => {
    const stored: GeoPoint = { lat: -27.46, lng: -58.99 };
    const result = await new MockRouteOptimizer(configService).optimize(
      buildInput([{ stop_id: 1, address: 'Calle 1', coordinates: stored }]),
    );

    expect(result.stops[0].coordinate_source).toBe('DATABASE');
    expect(result.stops[0].coordinates).toEqual(stored);
  });

  it('ordena las paradas por cercanía partiendo del depósito', async () => {
    const input: RouteOptimizerInput = {
      route_sheet_id: 1,
      depot: { lat: 0, lng: 0 },
      end_point: null,
      // Se cargan desordenadas a propósito.
      stops: [
        { stop_id: 30, address: 'lejos', coordinates: { lat: 0, lng: 0.03 } },
        { stop_id: 10, address: 'cerca', coordinates: { lat: 0, lng: 0.01 } },
        { stop_id: 20, address: 'medio', coordinates: { lat: 0, lng: 0.02 } },
      ],
    };

    const result = await new MockRouteOptimizer(configService).optimize(input);

    expect(result.stops.map((s) => s.stop_id)).toEqual([10, 20, 30]);
    expect(result.stops.map((s) => s.sequence_number)).toEqual([1, 2, 3]);
  });

  it('estima la duración con la cantidad real de paradas', async () => {
    const result = await new MockRouteOptimizer(configService).optimize({
      route_sheet_id: 1,
      depot: { lat: 0, lng: 0 },
      end_point: null,
      stops: [
        { stop_id: 1, address: null, coordinates: { lat: 0, lng: 0 } },
        { stop_id: 2, address: null, coordinates: { lat: 0, lng: 0 } },
        { stop_id: 3, address: null, coordinates: { lat: 0, lng: 0 } },
      ],
    });

    // Sin distancia recorrida, sólo queda el tiempo de atención: 3 paradas x 5 min.
    expect(result.estimated_distance_km).toBe(0);
    expect(result.estimated_duration_minutes).toBe(15);
  });
});
