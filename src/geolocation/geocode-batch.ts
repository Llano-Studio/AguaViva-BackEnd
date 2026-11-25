import { Prisma, PrismaClient } from '@prisma/client';
import {
  GEO_PRECISION,
  GEO_SOURCE,
  GeoPoint,
  GeoPrecision,
  ServiceArea,
  extractUrl,
  isInsideArea,
  isShortMapsLink,
  parseCoordinatesFromText,
  roundCoordinate,
} from './geo.rules';
import { GeocodeResult } from './google-geocoder';

export interface GeocodeCandidate {
  person_id: number;
  address: string | null;
  locality: string | null;
  province: string | null;
  /** Texto con un link de Google Maps o coordenadas (AguaRica: person.location). */
  location_text?: string | null;
}

export type BatchOutcome =
  | 'SAVED'
  | 'FOUND_NOT_SAVED'
  | 'APPROXIMATE_SKIPPED'
  | 'NOT_FOUND'
  | 'NO_ADDRESS'
  | 'OUT_OF_AREA'
  | 'ALREADY_LOCATED'
  | 'ERROR';

export interface BatchRow {
  person_id: number;
  query: string;
  source: string;
  outcome: BatchOutcome;
  precision: GeoPrecision | '';
  lat: number | '';
  lng: number | '';
  formatted_address: string;
  detail: string;
}

export interface BatchOptions {
  apply: boolean;
  includeApproximate: boolean;
  delayMs: number;
}

export interface Geocoder {
  geocode(address: string): Promise<GeocodeResult>;
}

type RedirectFetch = (
  url: string,
  init: { redirect: 'manual'; signal?: AbortSignal },
) => Promise<{ status: number; headers: { get(name: string): string | null } }>;

/** Sigue un link corto de Google Maps hasta la URL final (sin API key). */
export async function resolveShortLink(
  url: string,
  fetchImpl: RedirectFetch = (u, init) => fetch(u, init),
): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    });
    const next = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !next) {
      return hop === 0 ? null : current;
    }
    current = new URL(next, current).toString();
    if (parseCoordinatesFromText(current)) return current;
  }
  return current;
}

export function buildQuery(candidate: GeocodeCandidate): string {
  return [
    candidate.address,
    candidate.locality,
    candidate.province,
    'Argentina',
  ]
    .map((part) => part?.trim())
    .filter((part) => part)
    .join(', ');
}

/**
 * Ubica una lista de clientes. Solo guarda si `apply` y nunca pisa un punto de
 * administración, de un link de Maps o del GPS del chofer.
 */
export async function runGeocodeBatch(
  prisma: PrismaClient,
  geocoder: Geocoder | null,
  area: ServiceArea,
  candidates: GeocodeCandidate[],
  options: BatchOptions,
  hooks: {
    resolveLink?: (url: string) => Promise<string | null>;
    log?: (message: string) => void;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<{ rows: BatchRow[]; aborted: string | null }> {
  const resolveLink = hooks.resolveLink ?? ((url) => resolveShortLink(url));
  const log = hooks.log ?? (() => undefined);
  const sleep =
    hooks.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const rows: BatchRow[] = [];

  for (const [index, candidate] of candidates.entries()) {
    const query = buildQuery(candidate);
    const base = {
      person_id: candidate.person_id,
      query,
      formatted_address: '',
      detail: '',
    };

    // 1) Link de Google Maps o coordenadas que ya tenía el cliente.
    const fromLink = await pointFromLocationText(
      candidate.location_text,
      resolveLink,
    );
    if (fromLink) {
      if (!isInsideArea(fromLink, area)) {
        rows.push({
          ...base,
          source: GEO_SOURCE.MAPS_LINK,
          outcome: 'OUT_OF_AREA',
          precision: '',
          lat: fromLink.lat,
          lng: fromLink.lng,
        });
      } else {
        const outcome = await save(
          prisma,
          candidate.person_id,
          fromLink,
          GEO_SOURCE.MAPS_LINK,
          GEO_PRECISION.EXACT,
          options.apply,
        );
        rows.push({
          ...base,
          source: GEO_SOURCE.MAPS_LINK,
          outcome,
          precision: GEO_PRECISION.EXACT,
          lat: fromLink.lat,
          lng: fromLink.lng,
        });
        continue;
      }
    }

    // 2) Geocodificación de la dirección.
    if (!candidate.address?.trim()) {
      rows.push({
        ...base,
        source: '',
        outcome: 'NO_ADDRESS',
        precision: '',
        lat: '',
        lng: '',
      });
      continue;
    }
    if (!geocoder) {
      rows.push({
        ...base,
        source: '',
        outcome: 'ERROR',
        precision: '',
        lat: '',
        lng: '',
        detail: 'Sin GOOGLE_GEOCODING_API_KEY',
      });
      continue;
    }
    const result = await geocoder.geocode(query);
    if (index < candidates.length - 1 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
    if (result.status === 'QUOTA_EXCEEDED' || result.status === 'DENIED') {
      const reason =
        `Google respondió ${result.status}: ${result.detail ?? ''}`.trim();
      log(reason);
      return { rows, aborted: reason };
    }
    const geo = {
      source: GEO_SOURCE.GOOGLE_GEOCODING,
      formatted_address: result.formatted_address ?? '',
    };
    if (result.status === 'NOT_FOUND') {
      rows.push({
        ...base,
        ...geo,
        outcome: 'NOT_FOUND',
        precision: '',
        lat: '',
        lng: '',
      });
      continue;
    }
    if (result.status === 'OUT_OF_AREA') {
      rows.push({
        ...base,
        ...geo,
        outcome: 'OUT_OF_AREA',
        precision: '',
        lat: result.point?.lat ?? '',
        lng: result.point?.lng ?? '',
      });
      continue;
    }
    if (result.status !== 'OK' || !result.point || !result.precision) {
      rows.push({
        ...base,
        ...geo,
        outcome: 'ERROR',
        precision: '',
        lat: '',
        lng: '',
        detail: result.detail ?? result.status,
      });
      continue;
    }
    if (
      result.precision === GEO_PRECISION.APPROXIMATE &&
      !options.includeApproximate
    ) {
      rows.push({
        ...base,
        ...geo,
        outcome: 'APPROXIMATE_SKIPPED',
        precision: result.precision,
        lat: result.point.lat,
        lng: result.point.lng,
      });
      continue;
    }
    const outcome = await save(
      prisma,
      candidate.person_id,
      result.point,
      GEO_SOURCE.GOOGLE_GEOCODING,
      result.precision,
      options.apply,
    );
    rows.push({
      ...base,
      ...geo,
      outcome,
      precision: result.precision,
      lat: result.point.lat,
      lng: result.point.lng,
    });

    if ((index + 1) % 50 === 0)
      log(`${index + 1}/${candidates.length} procesados`);
  }
  return { rows, aborted: null };
}

async function pointFromLocationText(
  text: string | null | undefined,
  resolveLink: (url: string) => Promise<string | null>,
): Promise<GeoPoint | null> {
  const direct = parseCoordinatesFromText(text);
  if (direct) return direct;
  if (!isShortMapsLink(text)) return null;
  const url = extractUrl(text);
  if (!url) return null;
  try {
    return parseCoordinatesFromText(await resolveLink(url));
  } catch {
    return null;
  }
}

async function save(
  prisma: PrismaClient,
  personId: number,
  point: GeoPoint,
  source: string,
  precision: GeoPrecision,
  apply: boolean,
): Promise<BatchOutcome> {
  if (!apply) return 'FOUND_NOT_SAVED';
  // Solo clientes sin punto o con un punto de geocodificación anterior.
  const where: Prisma.personWhereInput = {
    person_id: personId,
    OR: [{ geo_source: null }, { geo_source: GEO_SOURCE.GOOGLE_GEOCODING }],
  };
  const updated = await prisma.person.updateMany({
    where,
    data: {
      lat: roundCoordinate(point.lat),
      lng: roundCoordinate(point.lng),
      geo_source: source,
      geo_precision: precision,
      geo_updated_at: new Date(),
    },
  });
  return updated.count === 1 ? 'SAVED' : 'ALREADY_LOCATED';
}

export function toCsv(rows: BatchRow[]): string {
  const header = [
    'person_id',
    'resultado',
    'origen',
    'precision',
    'lat',
    'lng',
    'consulta',
    'direccion_google',
    'detalle',
  ];
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    header.join(','),
    ...rows.map((r) =>
      [
        r.person_id,
        r.outcome,
        r.source,
        r.precision,
        r.lat,
        r.lng,
        r.query,
        r.formatted_address,
        r.detail,
      ]
        .map(escape)
        .join(','),
    ),
  ].join('\n');
}
