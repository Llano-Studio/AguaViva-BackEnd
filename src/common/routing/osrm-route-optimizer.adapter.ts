import {
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeoPoint,
  ResolvedStop,
  RouteOptimizer,
  RouteOptimizerInput,
  RouteOptimizerResult,
} from './route-optimizer.port';

/**
 * Implementacion real: servicio autoalojado OSRM + VROOM
 * (repo Llano-Studio/routing-osrm-vroom).
 *
 * VROOM ordena las paradas usando tiempos y distancias reales por calle que le
 * da OSRM. Solo trabaja con coordenadas verificadas: si alguna parada no tiene
 * coordenadas, responde 422 con la lista en lugar de inventar un orden.
 */
export interface OsrmRoutingConfig {
  /** URL del gateway, sin barra final. Ej.: https://ruteo.example.com */
  baseUrl: string;
  /** Token Bearer que exige el gateway. */
  apiToken: string;
  timeoutMs: number;
  /** Perfil de vehiculo configurado en VROOM (por defecto "car"). */
  profile: string;
  /** Minutos de atencion por parada que suma VROOM al tiempo de manejo. */
  serviceMinutesPerStop: number;
}

/** Lee y valida la configuracion. Falla al iniciar si falta algo. */
export function readOsrmRoutingConfig(
  configService: ConfigService,
): OsrmRoutingConfig {
  const baseUrl = (
    configService.get<string>('app.routeOptimization.osrm.baseUrl') || ''
  )
    .trim()
    .replace(/\/+$/, '');
  const apiToken = (
    configService.get<string>('app.routeOptimization.osrm.apiToken') || ''
  ).trim();
  const timeoutMs = Number(
    configService.get<number>('app.routeOptimization.osrm.timeoutMs'),
  );
  const profile = (
    configService.get<string>('app.routeOptimization.osrm.profile') || 'car'
  ).trim();
  const serviceMinutesPerStop = Number(
    configService.get<number>('app.routeOptimization.serviceMinutesPerStop'),
  );

  if (!/^https?:\/\/[^\s/]+/.test(baseUrl)) {
    throw new Error(
      'ROUTE_OPTIMIZER_PROVIDER=osrm requiere ROUTING_BASE_URL con la URL del ' +
        'servicio de ruteo (ej.: https://ruteo.example.com).',
    );
  }
  if (!apiToken) {
    throw new Error(
      'ROUTE_OPTIMIZER_PROVIDER=osrm requiere ROUTING_API_TOKEN (el mismo ' +
        'token configurado en el servicio de ruteo).',
    );
  }

  return {
    baseUrl,
    apiToken,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000,
    profile: profile || 'car',
    serviceMinutesPerStop:
      Number.isFinite(serviceMinutesPerStop) && serviceMinutesPerStop >= 0
        ? serviceMinutesPerStop
        : 0,
  };
}

type VroomLocation = [number, number];

interface VroomProblem {
  vehicles: Array<{
    id: number;
    profile: string;
    start: VroomLocation;
    end?: VroomLocation;
  }>;
  jobs: Array<{ id: number; location: VroomLocation; service: number }>;
  /** g: pedir la geometria; sin ella VROOM no informa la distancia. */
  options: { g: boolean };
}

interface VroomStep {
  type: string;
  job?: number;
}

interface VroomRoute {
  steps: VroomStep[];
  duration?: number;
  distance?: number;
  service?: number;
  waiting_time?: number;
}

interface VroomSolution {
  code?: number;
  error?: string;
  unassigned?: Array<{ id: number }>;
  routes?: VroomRoute[];
}

/** Codigos de error de VROOM: 1 interno, 2 entrada invalida, 3 ruteo. */
const VROOM_ROUTING_ERROR = 3;

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ status: number; text(): Promise<string> }>;

export class OsrmRouteOptimizer implements RouteOptimizer {
  readonly provider = 'osrm';
  readonly is_simulated = false;

  private readonly logger = new Logger(OsrmRouteOptimizer.name);

  constructor(
    private readonly config: OsrmRoutingConfig,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
  ) {}

  async optimize(input: RouteOptimizerInput): Promise<RouteOptimizerResult> {
    const missing = input.stops
      .filter((stop) => !stop.coordinates)
      .map((stop) => stop.stop_id);
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        message:
          `No se puede optimizar: ${missing.length} parada(s) no tienen ` +
          'coordenadas. Cargá la ubicación de esos clientes y volvé a intentar.',
        missing_coordinates: missing,
      });
    }

    if (input.stops.length === 0) {
      return this.buildResult(input, [], 0, 0);
    }

    const problem: VroomProblem = {
      options: { g: true },
      vehicles: [
        {
          id: 1,
          profile: this.config.profile,
          start: this.toLocation(input.depot),
          ...(input.end_point ? { end: this.toLocation(input.end_point) } : {}),
        },
      ],
      // VROOM necesita IDs enteros unicos: se usa la posicion de la parada.
      jobs: input.stops.map((stop, index) => ({
        id: index + 1,
        location: this.toLocation(stop.coordinates),
        service: Math.round(this.config.serviceMinutesPerStop * 60),
      })),
    };

    const solution = await this.solve(problem, input.route_sheet_id);

    if (solution.unassigned && solution.unassigned.length > 0) {
      const unreachable = solution.unassigned.map(
        (job) => input.stops[job.id - 1]?.stop_id ?? null,
      );
      throw new UnprocessableEntityException({
        message:
          `No se puede optimizar: ${unreachable.length} parada(s) no tienen ` +
          'recorrido posible. Revisá que sus coordenadas estén bien y dentro ' +
          'de la zona del mapa.',
        unreachable_stops: unreachable,
      });
    }

    const route = solution.routes?.[0];
    if (!route) {
      throw new ServiceUnavailableException(
        'El servicio de ruteo devolvió una respuesta sin recorrido.',
      );
    }

    const ordered = route.steps
      .filter((step) => step.type === 'job' && typeof step.job === 'number')
      .map((step) => input.stops[step.job - 1]);

    if (
      ordered.length !== input.stops.length ||
      ordered.some((stop) => stop === undefined)
    ) {
      throw new ServiceUnavailableException(
        'El servicio de ruteo devolvió un recorrido incompleto.',
      );
    }

    const stops: ResolvedStop[] = ordered.map((stop, index) => ({
      stop_id: stop.stop_id,
      sequence_number: index + 1,
      coordinates: stop.coordinates,
      coordinate_source: 'DATABASE',
      address: stop.address ?? null,
    }));

    const totalSeconds =
      (route.duration ?? 0) + (route.service ?? 0) + (route.waiting_time ?? 0);

    return this.buildResult(
      input,
      stops,
      (route.distance ?? 0) / 1000,
      totalSeconds / 60,
    );
  }

  private async solve(
    problem: VroomProblem,
    routeSheetId: number,
  ): Promise<VroomSolution> {
    const url = `${this.config.baseUrl}/vroom/`;
    let status: number;
    let body: string;

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(problem),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      status = response.status;
      body = await response.text();
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError'
          ? `no respondió en ${this.config.timeoutMs} ms`
          : `no está disponible (${error instanceof Error ? error.message : String(error)})`;
      this.logger.error(`Hoja ${routeSheetId}: el servicio de ruteo ${reason}`);
      throw new ServiceUnavailableException(
        'El servicio de ruteo no está disponible. Intentá de nuevo en unos minutos.',
      );
    }

    if (status === 401 || status === 403) {
      this.logger.error(
        `Hoja ${routeSheetId}: el servicio de ruteo rechazó el pedido (${status}). ` +
          'Revisar ROUTING_API_TOKEN y que la IP del backend esté en ALLOWED_IPS.',
      );
      throw new ServiceUnavailableException(
        'El servicio de ruteo rechazó la conexión del sistema.',
      );
    }

    let solution: VroomSolution;
    try {
      solution = JSON.parse(body) as VroomSolution;
    } catch {
      this.logger.error(
        `Hoja ${routeSheetId}: respuesta no JSON del servicio de ruteo (${status}): ${body.slice(0, 200)}`,
      );
      throw new ServiceUnavailableException(
        'El servicio de ruteo devolvió una respuesta inválida.',
      );
    }

    if (status >= 200 && status < 300 && solution.code === 0) {
      return solution;
    }

    if (solution.code === VROOM_ROUTING_ERROR) {
      throw new UnprocessableEntityException({
        message:
          'No se pudo calcular el recorrido: alguna parada no tiene acceso ' +
          'por calle. Revisá que las coordenadas estén dentro de la zona del mapa.',
        detail: solution.error ?? null,
      });
    }

    this.logger.error(
      `Hoja ${routeSheetId}: error del servicio de ruteo (${status}, code ${String(solution.code)}): ${solution.error ?? body.slice(0, 200)}`,
    );
    if (status >= 500) {
      throw new ServiceUnavailableException(
        'El servicio de ruteo tuvo un error. Intentá de nuevo en unos minutos.',
      );
    }
    throw new InternalServerErrorException(
      'El servicio de ruteo no aceptó el pedido de optimización.',
    );
  }

  private buildResult(
    input: RouteOptimizerInput,
    stops: ResolvedStop[],
    distanceKm: number,
    durationMinutes: number,
  ): RouteOptimizerResult {
    return {
      provider: this.provider,
      is_simulated: false,
      depot: input.depot,
      end_point: input.end_point,
      stops,
      estimated_distance_km: Math.round(distanceKm * 100) / 100,
      estimated_duration_minutes: Math.round(durationMinutes),
    };
  }

  /** VROOM y OSRM usan [longitud, latitud]. */
  private toLocation(point: GeoPoint): VroomLocation {
    return [point.lng, point.lat];
  }
}
