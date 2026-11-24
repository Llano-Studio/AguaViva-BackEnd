import {
  HttpException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FetchLike,
  OsrmRouteOptimizer,
  OsrmRoutingConfig,
  readOsrmRoutingConfig,
} from './osrm-route-optimizer.adapter';
import { RouteOptimizerInput } from './route-optimizer.port';

const config: OsrmRoutingConfig = {
  baseUrl: 'https://ruteo.test',
  apiToken: 'secreto',
  timeoutMs: 5000,
  profile: 'car',
  serviceMinutesPerStop: 5,
};

const depot = { lat: -27.493444, lng: -58.943556 };

function input(
  overrides: Partial<RouteOptimizerInput> = {},
): RouteOptimizerInput {
  return {
    route_sheet_id: 345,
    depot,
    end_point: depot,
    stops: [
      {
        stop_id: 11,
        address: 'Calle 1',
        coordinates: { lat: -27.45, lng: -58.98 },
      },
      {
        stop_id: 12,
        address: 'Calle 2',
        coordinates: { lat: -27.48, lng: -58.93 },
      },
      {
        stop_id: 13,
        address: 'Calle 3',
        coordinates: { lat: -27.46, lng: -58.83 },
      },
    ],
    ...overrides,
  };
}

type FetchMock = jest.Mock<ReturnType<FetchLike>, Parameters<FetchLike>>;

function respond(status: number, body: unknown): FetchMock {
  return jest
    .fn<ReturnType<FetchLike>, Parameters<FetchLike>>()
    .mockResolvedValue({
      status,
      text: () =>
        Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
    });
}

function failing(error: Error): FetchMock {
  return jest
    .fn<ReturnType<FetchLike>, Parameters<FetchLike>>()
    .mockRejectedValue(error);
}

/** Cuerpo JSON enviado en la llamada n del mock. */
interface SentProblem {
  options: Record<string, unknown>;
  vehicles: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
}

/** Problema enviado a VROOM en la llamada n del mock. */
function sentBody(fetchMock: FetchMock, call = 0): SentProblem {
  return JSON.parse(fetchMock.mock.calls[call][1].body) as SentProblem;
}

/** Solución de VROOM que visita los jobs en el orden indicado. */
function solution(jobOrder: number[]) {
  return {
    code: 0,
    unassigned: [],
    routes: [
      {
        steps: [
          { type: 'start' },
          ...jobOrder.map((job) => ({ type: 'job', job })),
          { type: 'end' },
        ],
        duration: 1800,
        distance: 21450,
        service: 900,
        waiting_time: 0,
      },
    ],
  };
}

async function rejection(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('se esperaba un error');
}

describe('OsrmRouteOptimizer', () => {
  it('manda el problema a VROOM y persiste el orden que devuelve', async () => {
    const fetchMock = respond(200, solution([2, 3, 1]));
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    const result = await optimizer.optimize(input());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ruteo.test/vroom/');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer secreto');
    expect(sentBody(fetchMock)).toEqual({
      options: { g: true },
      vehicles: [
        {
          id: 1,
          profile: 'car',
          start: [-58.943556, -27.493444],
          end: [-58.943556, -27.493444],
        },
      ],
      jobs: [
        { id: 1, location: [-58.98, -27.45], service: 300 },
        { id: 2, location: [-58.93, -27.48], service: 300 },
        { id: 3, location: [-58.83, -27.46], service: 300 },
      ],
    });

    expect(result.provider).toBe('osrm');
    expect(result.is_simulated).toBe(false);
    expect(
      result.stops.map((stop) => [stop.stop_id, stop.sequence_number]),
    ).toEqual([
      [12, 1],
      [13, 2],
      [11, 3],
    ]);
    expect(result.stops.every((s) => s.coordinate_source === 'DATABASE')).toBe(
      true,
    );
    expect(result.estimated_distance_km).toBe(21.45);
    // 1800 s de manejo + 900 s de atención = 45 minutos.
    expect(result.estimated_duration_minutes).toBe(45);
  });

  it('sin punto de cierre, el vehículo no tiene "end"', async () => {
    const fetchMock = respond(200, solution([1, 2, 3]));
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    await optimizer.optimize(input({ end_point: null }));

    expect(sentBody(fetchMock).vehicles[0]).not.toHaveProperty('end');
  });

  it('responde 422 con la lista de paradas sin coordenadas, sin llamar al servicio', async () => {
    const fetchMock = respond(200, solution([1]));
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    const error = await rejection(
      optimizer.optimize(
        input({
          stops: [
            { stop_id: 11, coordinates: { lat: -27.45, lng: -58.98 } },
            { stop_id: 12, coordinates: null },
            { stop_id: 14, coordinates: null },
          ],
        }),
      ),
    );

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse()).toMatchObject({
      missing_coordinates: [12, 14],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin paradas devuelve un recorrido vacío sin llamar al servicio', async () => {
    const fetchMock = respond(200, solution([]));
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    const result = await optimizer.optimize(input({ stops: [] }));

    expect(result.stops).toEqual([]);
    expect(result.estimated_distance_km).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('responde 422 si VROOM deja paradas sin asignar', async () => {
    const fetchMock = respond(200, {
      ...solution([1, 3]),
      unassigned: [{ id: 2 }],
    });
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    const error = await rejection(optimizer.optimize(input()));

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse()).toMatchObject({ unreachable_stops: [12] });
  });

  it('responde 422 ante un error de ruteo de VROOM (code 3)', async () => {
    const fetchMock = respond(500, { code: 3, error: 'Unfound route(s).' });
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    const error = await rejection(optimizer.optimize(input()));

    expect(error).toBeInstanceOf(UnprocessableEntityException);
    expect(error.getResponse()).toMatchObject({ detail: 'Unfound route(s).' });
  });

  it.each([401, 403])(
    'responde 503 si el gateway rechaza la conexión (%i)',
    async (status) => {
      const fetchMock = respond(status, 'Unauthorized');
      const optimizer = new OsrmRouteOptimizer(config, fetchMock);

      await expect(optimizer.optimize(input())).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it('responde 503 si el servicio no responde', async () => {
    const fetchMock = failing(new Error('ECONNREFUSED'));
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    await expect(optimizer.optimize(input())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('responde 503 cuando se agota el tiempo de espera', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    const fetchMock = failing(timeout);
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    await expect(optimizer.optimize(input())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('responde 503 ante un error interno de VROOM y 500 ante un pedido inválido', async () => {
    const internal = new OsrmRouteOptimizer(
      config,
      respond(500, { code: 1, error: 'Internal error' }),
    );
    await expect(internal.optimize(input())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    const invalid = new OsrmRouteOptimizer(
      config,
      respond(400, { code: 2, error: 'Invalid profile' }),
    );
    await expect(invalid.optimize(input())).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('responde 503 si el recorrido vuelve incompleto', async () => {
    const fetchMock = respond(200, solution([1, 2]));
    const optimizer = new OsrmRouteOptimizer(config, fetchMock);

    await expect(optimizer.optimize(input())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('readOsrmRoutingConfig', () => {
  const build = (values: Record<string, unknown>): ConfigService =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  it('lee la configuración, saca la barra final y aplica valores por defecto', () => {
    expect(
      readOsrmRoutingConfig(
        build({
          'app.routeOptimization.osrm.baseUrl': 'https://ruteo.test/',
          'app.routeOptimization.osrm.apiToken': ' secreto ',
          'app.routeOptimization.serviceMinutesPerStop': 5,
        }),
      ),
    ).toEqual({
      baseUrl: 'https://ruteo.test',
      apiToken: 'secreto',
      timeoutMs: 15000,
      profile: 'car',
      serviceMinutesPerStop: 5,
    });
  });

  it('falla si falta la URL o el token', () => {
    expect(() =>
      readOsrmRoutingConfig(
        build({ 'app.routeOptimization.osrm.apiToken': 'secreto' }),
      ),
    ).toThrow(/ROUTING_BASE_URL/);
    expect(() =>
      readOsrmRoutingConfig(
        build({ 'app.routeOptimization.osrm.baseUrl': 'https://ruteo.test' }),
      ),
    ).toThrow(/ROUTING_API_TOKEN/);
  });
});
