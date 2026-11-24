/**
 * Reglas de geolocalización de clientes: de dónde sale cada coordenada, cuál
 * manda cuando hay varias y cómo validar que caiga en la zona de operación.
 */

/** Origen de la coordenada guardada en el cliente. */
export const GEO_SOURCE = {
  /** Cargada o corregida por administración en el mapa. */
  ADMIN: 'ADMIN',
  /** Sacada de un link de Google Maps que ya tenía el cliente. */
  MAPS_LINK: 'MAPS_LINK',
  /** Geocodificación de la dirección con la API de Google. */
  GOOGLE_GEOCODING: 'GOOGLE_GEOCODING',
  /** GPS del teléfono del chofer al confirmar una entrega. */
  DRIVER_GPS: 'DRIVER_GPS',
} as const;
export type GeoSource = (typeof GEO_SOURCE)[keyof typeof GEO_SOURCE];

/** Qué tan confiable es el punto. */
export const GEO_PRECISION = {
  /** El punto es la casa (techo, GPS o marcado a mano). */
  EXACT: 'EXACT',
  /** Interpolado entre alturas de la cuadra. */
  INTERPOLATED: 'INTERPOLATED',
  /** Centro de la calle, del barrio o de la localidad: no sirve para rutear. */
  APPROXIMATE: 'APPROXIMATE',
} as const;
export type GeoPrecision = (typeof GEO_PRECISION)[keyof typeof GEO_PRECISION];

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Zona de operación: oeste, sur, este, norte. */
export interface ServiceArea {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Gran Resistencia (Puerto Tirol, Fontana, Barranqueras, Vilelas) y Corrientes. */
export const DEFAULT_SERVICE_AREA = '-59.15,-27.62,-58.65,-27.30';

export function readServiceArea(raw?: string | null): ServiceArea {
  const parts = (raw?.trim() || DEFAULT_SERVICE_AREA).split(',').map(Number);
  const [west, south, east, north] = parts;
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isFinite(n)) ||
    west >= east ||
    south >= north
  ) {
    throw new Error(
      'GEO_SERVICE_AREA_BBOX inválido: se espera "oeste,sur,este,norte" en grados',
    );
  }
  return { west, south, east, north };
}

export function isInsideArea(point: GeoPoint, area: ServiceArea): boolean {
  return (
    point.lng >= area.west &&
    point.lng <= area.east &&
    point.lat >= area.south &&
    point.lat <= area.north
  );
}

/**
 * Prioridad de una coordenada: una de prioridad menor nunca pisa a una mayor.
 * El GPS del chofer queda por debajo de una geocodificación exacta: confirma
 * desde donde estacionó, que puede estar a media cuadra.
 */
export function locationRank(
  source: string | null | undefined,
  precision: string | null | undefined,
): number {
  if (!source) return 0;
  if (source === GEO_SOURCE.ADMIN) return 100;
  if (source === GEO_SOURCE.MAPS_LINK) return 70;
  if (source === GEO_SOURCE.DRIVER_GPS) return 55;
  if (source === GEO_SOURCE.GOOGLE_GEOCODING) {
    if (precision === GEO_PRECISION.EXACT) return 60;
    if (precision === GEO_PRECISION.INTERPOLATED) return 50;
    return 20;
  }
  return 10;
}

/** Busca coordenadas dentro de un texto: link de Google Maps o "lat, lng". */
export function parseCoordinatesFromText(
  text: string | null | undefined,
): GeoPoint | null {
  if (!text) return null;
  const value = decodeURIComponent(text);
  const patterns = [
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // punto exacto del lugar
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, // centro del mapa
    /[?&](?:q|ll|query|destination|daddr)=(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /^\s*(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})\s*$/, // "lat, lng"
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

/** ¿Es un link corto de Google Maps que hay que resolver para ver el punto? */
export function isShortMapsLink(text: string | null | undefined): boolean {
  return /https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\/\S+/i.test(text ?? '');
}

export function extractUrl(text: string | null | undefined): string | null {
  return text?.match(/https?:\/\/\S+/i)?.[0] ?? null;
}

/** Link para abrir la navegación hasta el cliente en Google Maps. */
export function navigationUrl(point: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
}

/** Redondeo a 7 decimales (~1 cm), suficiente y estable para comparar. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}
