import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeoPoint,
  ResolvedStop,
  RouteOptimizer,
  RouteOptimizerInput,
  RouteOptimizerResult,
  RouteStopInput,
} from './route-optimizer.port';

/**
 * Implementacion de desarrollo y QA.
 *
 * Genera coordenadas y un orden de visitas de forma DETERMINISTA: la misma hoja
 * de ruta devuelve siempre el mismo resultado. No calcula recorridos reales por
 * calles ni considera trafico, por lo que distancia y duracion son estimaciones.
 *
 * Las coordenadas simuladas se marcan con `coordinate_source: 'SIMULATED'` para
 * que nunca se persistan como si fueran verificadas.
 */
@Injectable()
export class MockRouteOptimizer implements RouteOptimizer {
  readonly provider = 'mock';
  readonly is_simulated = true;

  private readonly logger = new Logger(MockRouteOptimizer.name);

  constructor(private readonly configService: ConfigService) {}

  optimize(input: RouteOptimizerInput): Promise<RouteOptimizerResult> {
    const radiusKm = this.getNumber('mockRadiusKm');
    const depot = input.depot;

    const resolved = input.stops.map((stop, index) =>
      this.resolveStop(stop, index, depot, radiusKm),
    );

    const ordered = this.orderByNearestNeighbour(depot, resolved);
    const stops = ordered.map((stop, index) => ({
      ...stop,
      sequence_number: index + 1,
    }));

    const estimatedDistance = this.calculateTotalDistance(
      depot,
      stops,
      input.end_point,
    );

    return Promise.resolve({
      provider: this.provider,
      is_simulated: true,
      depot,
      end_point: input.end_point,
      stops,
      estimated_distance_km: this.round2(estimatedDistance),
      estimated_duration_minutes: this.calculateDuration(
        estimatedDistance,
        stops.length,
      ),
    });
  }

  /**
   * Resuelve las coordenadas de una parada sin usar aleatoriedad.
   *
   * Prioridad: coordenada real guardada > coordenada derivada de la direccion >
   * coordenada derivada del ID del detalle.
   */
  private resolveStop(
    stop: RouteStopInput,
    index: number,
    depot: GeoPoint,
    radiusKm: number,
  ): ResolvedStop {
    if (stop.coordinates) {
      return {
        stop_id: stop.stop_id,
        sequence_number: 0,
        coordinates: stop.coordinates,
        coordinate_source: 'DATABASE',
        address: stop.address ?? null,
      };
    }

    const seed =
      this.normalizeSeed(stop.address) ??
      (stop.stop_id !== null ? `detail:${stop.stop_id}` : `index:${index}`);

    return {
      stop_id: stop.stop_id,
      sequence_number: 0,
      coordinates: this.simulateCoordinates(seed, depot, radiusKm),
      coordinate_source: 'SIMULATED',
      address: stop.address ?? null,
    };
  }

  /** Ordena por vecino mas cercano partiendo del deposito. */
  private orderByNearestNeighbour(
    depot: GeoPoint,
    stops: ResolvedStop[],
  ): ResolvedStop[] {
    const pending = [...stops];
    const ordered: ResolvedStop[] = [];
    let current = depot;

    while (pending.length > 0) {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < pending.length; i++) {
        const distance = this.haversineKm(current, pending[i].coordinates);

        // Desempate estable por ID para que el orden no dependa del recorrido
        // previo del arreglo cuando dos paradas quedan a la misma distancia.
        if (
          distance < bestDistance ||
          (distance === bestDistance &&
            this.compareStops(pending[i], pending[bestIndex]) < 0)
        ) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      current = pending[bestIndex].coordinates;
      ordered.push(pending[bestIndex]);
      pending.splice(bestIndex, 1);
    }

    return ordered;
  }

  private compareStops(a: ResolvedStop, b: ResolvedStop): number {
    const aKey = a.stop_id ?? Number.MAX_SAFE_INTEGER;
    const bKey = b.stop_id ?? Number.MAX_SAFE_INTEGER;
    if (aKey !== bKey) {
      return aKey - bKey;
    }
    return (a.address ?? '').localeCompare(b.address ?? '');
  }

  private simulateCoordinates(
    seed: string,
    depot: GeoPoint,
    radiusKm: number,
  ): GeoPoint {
    const angle = this.hashToUnit(`${seed}|angle`) * 2 * Math.PI;
    // sqrt distribuye los puntos de forma uniforme dentro del circulo.
    const distanceKm =
      Math.sqrt(this.hashToUnit(`${seed}|distance`)) * radiusKm;

    const latOffset = (distanceKm * Math.cos(angle)) / 111.32;
    const lngOffset =
      (distanceKm * Math.sin(angle)) /
      (111.32 * Math.cos((depot.lat * Math.PI) / 180));

    return {
      lat: this.round8(depot.lat + latOffset),
      lng: this.round8(depot.lng + lngOffset),
    };
  }

  private calculateTotalDistance(
    depot: GeoPoint,
    stops: ResolvedStop[],
    endPoint: GeoPoint | null,
  ): number {
    let totalKm = 0;
    let previous = depot;

    for (const stop of stops) {
      totalKm += this.haversineKm(previous, stop.coordinates);
      previous = stop.coordinates;
    }

    if (endPoint) {
      totalKm += this.haversineKm(previous, endPoint);
    }

    // La distancia en linea recta subestima el recorrido real por calles.
    return totalKm * this.getNumber('roadFactor');
  }

  private calculateDuration(distanceKm: number, stopCount: number): number {
    const travelMinutes = (distanceKm / this.getNumber('averageSpeedKmh')) * 60;
    const serviceMinutes = stopCount * this.getNumber('serviceMinutesPerStop');
    return Math.round(travelMinutes + serviceMinutes);
  }

  private haversineKm(from: GeoPoint, to: GeoPoint): number {
    const earthRadiusKm = 6371;
    const dLat = this.deg2rad(to.lat - from.lat);
    const dLng = this.deg2rad(to.lng - from.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.deg2rad(from.lat)) *
        Math.cos(this.deg2rad(to.lat)) *
        Math.sin(dLng / 2) ** 2;
    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private deg2rad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /** FNV-1a de 32 bits. Devuelve un valor estable en el rango [0, 1). */
  private hashToUnit(seed: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash / 0x100000000;
  }

  private normalizeSeed(address?: string | null): string | null {
    if (!address) {
      return null;
    }
    const normalized = address
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return normalized.length > 0 ? normalized : null;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private round8(value: number): number {
    return Math.round(value * 1e8) / 1e8;
  }

  private getNumber(key: string): number {
    const value = Number(
      this.configService.get<number>(`app.routeOptimization.${key}`),
    );
    if (!Number.isFinite(value)) {
      this.logger.warn(
        `Configuracion app.routeOptimization.${key} invalida, se usa 0.`,
      );
      return 0;
    }
    return value;
  }
}
