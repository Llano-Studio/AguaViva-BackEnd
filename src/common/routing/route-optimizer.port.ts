/**
 * Puerto de optimizacion de rutas.
 *
 * Define el contrato que consumen los servicios de la aplicacion. Las
 * implementaciones concretas (mock, Google, OSRM+VROOM) se intercambian por
 * configuracion sin cambiar este contrato.
 */

export const ROUTE_OPTIMIZER = 'ROUTE_OPTIMIZER';

export type RouteOptimizerProviderName = 'mock' | 'google' | 'osrm';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RouteStopInput {
  /** ID del detalle de hoja de ruta. Es null para puntos de inicio/cierre. */
  stop_id: number | null;
  /** Direccion del cliente, usada como semilla estable cuando no hay coordenadas. */
  address?: string | null;
  /** Coordenadas verificadas y ya persistidas. null cuando no existe el dato. */
  coordinates: GeoPoint | null;
}

export interface RouteOptimizerInput {
  route_sheet_id: number;
  /** Punto de partida del recorrido. */
  depot: GeoPoint;
  /** Punto de cierre. null cuando el recorrido no vuelve al deposito. */
  end_point: GeoPoint | null;
  stops: RouteStopInput[];
}

export interface ResolvedStop {
  stop_id: number | null;
  sequence_number: number;
  coordinates: GeoPoint;
  /**
   * DATABASE: coordenada verificada que ya estaba guardada.
   * SIMULATED: coordenada generada por la implementacion mock.
   */
  coordinate_source: 'DATABASE' | 'SIMULATED';
  address?: string | null;
}

export interface RouteOptimizerResult {
  provider: RouteOptimizerProviderName;
  /** true cuando distancia y duracion son estimaciones sin ruteo por calles. */
  is_simulated: boolean;
  depot: GeoPoint;
  end_point: GeoPoint | null;
  stops: ResolvedStop[];
  estimated_distance_km: number;
  estimated_duration_minutes: number;
}

export interface RouteOptimizer {
  readonly provider: RouteOptimizerProviderName;
  readonly is_simulated: boolean;
  optimize(input: RouteOptimizerInput): Promise<RouteOptimizerResult>;
}
