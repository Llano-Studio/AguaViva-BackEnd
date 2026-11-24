import {
  GEO_PRECISION,
  GeoPoint,
  GeoPrecision,
  ServiceArea,
  isInsideArea,
} from './geo.rules';

export type GeocodeStatus =
  | 'OK'
  | 'NOT_FOUND'
  | 'OUT_OF_AREA'
  | 'QUOTA_EXCEEDED'
  | 'DENIED'
  | 'ERROR';

export interface GeocodeResult {
  status: GeocodeStatus;
  point?: GeoPoint;
  precision?: GeoPrecision;
  formatted_address?: string;
  detail?: string;
}

type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ status: number; json(): Promise<unknown> }>;

interface GoogleResponse {
  status: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    partial_match?: boolean;
    geometry?: {
      location?: { lat: number; lng: number };
      location_type?: string;
    };
  }>;
}

/**
 * Geocodificación con la API de Google (Geocoding API). Busca solo en
 * Argentina, prioriza la zona de operación y descarta lo que cae afuera.
 */
export class GoogleGeocoder {
  constructor(
    private readonly apiKey: string,
    private readonly area: ServiceArea,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    private readonly timeoutMs = 10000,
  ) {
    if (!apiKey) throw new Error('Falta GOOGLE_GEOCODING_API_KEY');
  }

  async geocode(address: string): Promise<GeocodeResult> {
    const params = new URLSearchParams({
      address,
      components: 'country:AR',
      region: 'ar',
      language: 'es',
      bounds: `${this.area.south},${this.area.west}|${this.area.north},${this.area.east}`,
      key: this.apiKey,
    });
    let body: GoogleResponse;
    try {
      const response = await this.fetchImpl(
        `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`,
        { signal: AbortSignal.timeout(this.timeoutMs) },
      );
      body = (await response.json()) as GoogleResponse;
    } catch (error) {
      return {
        status: 'ERROR',
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    if (body.status === 'ZERO_RESULTS') return { status: 'NOT_FOUND' };
    if (
      body.status === 'OVER_QUERY_LIMIT' ||
      body.status === 'OVER_DAILY_LIMIT'
    ) {
      return { status: 'QUOTA_EXCEEDED', detail: body.error_message };
    }
    if (body.status === 'REQUEST_DENIED') {
      return { status: 'DENIED', detail: body.error_message };
    }
    if (body.status !== 'OK' || !body.results?.length) {
      return { status: 'ERROR', detail: body.error_message ?? body.status };
    }

    const best = body.results[0];
    const location = best.geometry?.location;
    if (!location) return { status: 'NOT_FOUND' };
    const point = { lat: location.lat, lng: location.lng };
    if (!isInsideArea(point, this.area)) {
      return {
        status: 'OUT_OF_AREA',
        point,
        formatted_address: best.formatted_address,
      };
    }

    return {
      status: 'OK',
      point,
      precision: best.partial_match
        ? GEO_PRECISION.APPROXIMATE
        : toPrecision(best.geometry?.location_type),
      formatted_address: best.formatted_address,
    };
  }
}

/** ROOFTOP: la casa; RANGE_INTERPOLATED: entre alturas; el resto, aproximado. */
export function toPrecision(locationType?: string): GeoPrecision {
  if (locationType === 'ROOFTOP') return GEO_PRECISION.EXACT;
  if (locationType === 'RANGE_INTERPOLATED') return GEO_PRECISION.INTERPOLATED;
  return GEO_PRECISION.APPROXIMATE;
}
