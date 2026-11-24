import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatBATimestampISO } from '../common/utils/date.utils';
import {
  GEO_PRECISION,
  GEO_SOURCE,
  GeoPoint,
  ServiceArea,
  isInsideArea,
  navigationUrl,
  readServiceArea,
  roundCoordinate,
} from './geo.rules';
import { detailCustomerId } from './geo.customer-ref';
import {
  DriverDeliveryLocationDto,
  DriverLocationCaptureResult,
  PendingLocationItemDto,
  PendingLocationsQueryDto,
  PendingLocationsResponseDto,
  PersonLocationDto,
  SetPersonLocationDto,
} from './dto/geolocation.dto';

const DEFAULT_GPS_MAX_ACCURACY_M = 50;

type PersonLocationRow = {
  person_id: number;
  lat: Prisma.Decimal | null;
  lng: Prisma.Decimal | null;
  geo_source: string | null;
  geo_precision: string | null;
  geo_updated_at: Date | null;
};

/**
 * Ubicación de los clientes: la marca administración, la completa el GPS del
 * chofer al entregar y la usan el optimizador de recorridos y la app del chofer.
 */
@Injectable()
export class GeolocationService {
  readonly area: ServiceArea = readServiceArea(
    process.env.GEO_SERVICE_AREA_BBOX,
  );
  private readonly gpsMaxAccuracyM =
    Number(process.env.DRIVER_GPS_MAX_ACCURACY_M) || DEFAULT_GPS_MAX_ACCURACY_M;

  constructor(private readonly prisma: PrismaService) {}

  /** Administración marca el punto en el mapa: es el dato que más manda. */
  async setManualLocation(
    personId: number,
    dto: SetPersonLocationDto,
  ): Promise<PersonLocationDto> {
    const point = { lat: dto.lat, lng: dto.lng };
    if (!isInsideArea(point, this.area)) {
      throw new BadRequestException(
        'El punto está fuera de la zona de operación. Revisá que latitud y longitud no estén invertidas.',
      );
    }
    try {
      const person = await this.prisma.person.update({
        where: { person_id: personId },
        data: {
          lat: roundCoordinate(point.lat),
          lng: roundCoordinate(point.lng),
          geo_source: GEO_SOURCE.ADMIN,
          geo_precision: GEO_PRECISION.EXACT,
          geo_updated_at: new Date(),
        },
        select: LOCATION_SELECT,
      });
      return toLocationDto(person);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(`Cliente ${personId} no encontrado`);
      }
      throw error;
    }
  }

  /**
   * GPS del chofer al confirmar una entrega. Solo completa clientes sin punto o
   * con uno impreciso, y solo si el teléfono informa buena precisión: nunca pisa
   * un punto marcado por administración, un link de Maps o una dirección exacta.
   */
  async captureFromDriver(
    detailId: number,
    location: DriverDeliveryLocationDto | undefined,
  ): Promise<DriverLocationCaptureResult> {
    if (!location) return { applied: false, reason: 'NO_LOCATION' };
    if (
      location.accuracy_m !== undefined &&
      location.accuracy_m > this.gpsMaxAccuracyM
    ) {
      return { applied: false, reason: 'LOW_ACCURACY' };
    }
    const point = { lat: location.lat, lng: location.lng };
    if (!isInsideArea(point, this.area)) {
      return { applied: false, reason: 'OUT_OF_AREA' };
    }
    // El punto real de la entrega queda en la parada, como historial.
    await this.prisma.route_sheet_detail.update({
      where: { route_sheet_detail_id: detailId },
      data: {
        lat: roundCoordinate(point.lat),
        lng: roundCoordinate(point.lng),
      },
    });

    const customerId = await detailCustomerId(this.prisma, detailId);
    if (customerId === null) return { applied: false, reason: 'NO_CUSTOMER' };

    // Condición en la misma escritura: si otro proceso ubicó al cliente con un
    // dato mejor mientras tanto, no se pisa.
    const updated = await this.prisma.person.updateMany({
      where: {
        person_id: customerId,
        OR: [
          { geo_source: null },
          {
            geo_source: GEO_SOURCE.GOOGLE_GEOCODING,
            geo_precision: {
              in: [GEO_PRECISION.INTERPOLATED, GEO_PRECISION.APPROXIMATE],
            },
          },
        ],
      },
      data: {
        lat: roundCoordinate(point.lat),
        lng: roundCoordinate(point.lng),
        geo_source: GEO_SOURCE.DRIVER_GPS,
        geo_precision: GEO_PRECISION.EXACT,
        geo_updated_at: new Date(),
      },
    });
    return updated.count === 1
      ? { applied: true }
      : { applied: false, reason: 'ALREADY_LOCATED' };
  }

  /** Clientes activos sin punto o con uno aproximado, para revisar en el mapa. */
  async listPending(
    query: PendingLocationsQueryDto,
  ): Promise<PendingLocationsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const missing: Prisma.personWhereInput = { lat: null };
    const approximate: Prisma.personWhereInput = {
      lat: { not: null },
      geo_precision: GEO_PRECISION.APPROXIMATE,
    };
    const reasonFilter =
      query.reason === 'MISSING'
        ? missing
        : query.reason === 'APPROXIMATE'
          ? approximate
          : { OR: [missing, approximate] };
    const where: Prisma.personWhereInput = { is_active: true, ...reasonFilter };

    const [rows, total, coverage] = await Promise.all([
      this.prisma.person.findMany({
        where,
        orderBy: [{ zone_id: 'asc' }, { person_id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...LOCATION_SELECT,
          name: true,
          address: true,
          locality: { select: { name: true } },
          zone: { select: { name: true } },
        },
      }),
      this.prisma.person.count({ where }),
      this.coverage(),
    ]);

    return {
      coverage,
      data: rows.map(
        (row): PendingLocationItemDto => ({
          ...toLocationDto(row),
          name: row.name ?? '',
          address: row.address ?? null,
          locality: row.locality?.name ?? null,
          zone: row.zone?.name ?? null,
          reason: row.lat === null ? 'MISSING' : 'APPROXIMATE',
        }),
      ),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  private async coverage() {
    const active: Prisma.personWhereInput = { is_active: true };
    const [total, missing, approximate] = await Promise.all([
      this.prisma.person.count({ where: active }),
      this.prisma.person.count({ where: { ...active, lat: null } }),
      this.prisma.person.count({
        where: {
          ...active,
          lat: { not: null },
          geo_precision: GEO_PRECISION.APPROXIMATE,
        },
      }),
    ]);
    return {
      total,
      located: total - missing - approximate,
      approximate,
      missing,
    };
  }
}

const LOCATION_SELECT = {
  person_id: true,
  lat: true,
  lng: true,
  geo_source: true,
  geo_precision: true,
  geo_updated_at: true,
} satisfies Prisma.personSelect;

export function toLocationDto(row: PersonLocationRow): PersonLocationDto {
  const point = personPoint(row);
  return {
    person_id: row.person_id,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    source: row.geo_source,
    precision: row.geo_precision,
    updated_at: row.geo_updated_at
      ? formatBATimestampISO(row.geo_updated_at)
      : null,
    navigation_url: point ? navigationUrl(point) : null,
  };
}

/** Coordenadas del cliente, o null si no tiene. */
export function personPoint(row: {
  lat: Prisma.Decimal | number | null;
  lng: Prisma.Decimal | number | null;
}): GeoPoint | null {
  if (row.lat === null || row.lng === null) return null;
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Coordenadas y link de navegación del cliente para la app del chofer. */
export function customerCoordinates(
  row: {
    lat: Prisma.Decimal | number | null;
    lng: Prisma.Decimal | number | null;
    geo_source?: string | null;
    geo_precision?: string | null;
  } | null,
): {
  coordinates: {
    lat: number;
    lng: number;
    source: string | null;
    precision: string | null;
  } | null;
  navigation_url: string | null;
} {
  const point = row ? personPoint(row) : null;
  if (!row || !point) return { coordinates: null, navigation_url: null };
  return {
    coordinates: {
      ...point,
      source: row.geo_source ?? null,
      precision: row.geo_precision ?? null,
    },
    navigation_url: navigationUrl(point),
  };
}
