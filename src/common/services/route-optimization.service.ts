import { Prisma } from '@prisma/client';
import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateRouteOptimizationDto,
  RouteOptimizationResponseDto,
  WaypointDto,
} from '../../route-sheet/dto/route-optimization.dto';
import {
  GeoPoint,
  ROUTE_OPTIMIZER,
  RouteOptimizer,
  RouteOptimizerResult,
  RouteStopInput,
} from '../routing/route-optimizer.port';
import { PrismaBackedService } from '../../prisma/prisma-backed.service';
import { PrismaService } from '../../prisma/prisma.service';
import { formatBATimestampISO } from '../utils/date.utils';
import { DELIVERY_SEQUENCE_ORDER_BY } from '../../route-sheet/delivery-locks';
import { splitForReoptimization } from '../../route-sheet/extra-deliveries/extra-delivery.rules';

export type ReoptimizationOutcome =
  | { mode: 'FULL'; provider: string }
  | { mode: 'PENDING'; provider: string; reordered: number }
  | {
      mode: 'NONE';
      reason: 'CLOSED' | 'NOTHING_TO_REORDER' | 'CONCURRENT_CHANGES';
    };

type PendingReorder =
  | {
      status: 'APPLIED';
      result: RouteOptimizerResult;
      start: GeoPoint;
      endPoint: GeoPoint | null;
      fixedCount: number;
      reordered: number;
    }
  | { status: 'NOTHING_TO_REORDER' }
  | { status: 'CONCURRENT_CHANGES' };

@Injectable()
export class RouteOptimizationService extends PrismaBackedService {
  constructor(
    prisma: PrismaService,
    @Inject(ROUTE_OPTIMIZER)
    private readonly routeOptimizer: RouteOptimizer,
    private readonly configService: ConfigService,
  ) {
    super(prisma);
  }

  /**
   * Optimiza el recorrido de una hoja de ruta y persiste la secuencia resultante.
   *
   * El calculo se delega al proveedor configurado. Con `mock`, las coordenadas
   * faltantes se derivan de la direccion y se marcan como simuladas: nunca se
   * guardan en el detalle como si fueran verificadas. Con `osrm`, todas las
   * paradas necesitan coordenadas guardadas; si falta alguna, responde 422.
   */
  async optimizeRoute(
    createDto: CreateRouteOptimizationDto,
  ): Promise<RouteOptimizationResponseDto> {
    const { route_sheet_id } = createDto;

    try {
      const routeSheet = await this.route_sheet.findUnique({
        where: { route_sheet_id },
        include: {
          route_sheet_detail: {
            include: {
              order_header: {
                include: {
                  customer: true,
                },
              },
              one_off_purchase: {
                include: {
                  person: true,
                },
              },
              one_off_purchase_header: {
                include: {
                  person: true,
                },
              },
            },
          },
        },
      });

      if (!routeSheet) {
        throw new NotFoundException(
          `Hoja de ruta con ID ${route_sheet_id} no encontrada`,
        );
      }

      // En curso o pausada: no se mueve lo hecho ni la parada actual.
      if (
        routeSheet.execution_status === 'IN_PROGRESS' ||
        routeSheet.execution_status === 'PAUSED'
      ) {
        return await this.optimizePendingRoute(route_sheet_id);
      }

      const depot = this.resolveDepot(createDto);
      const endPoint = this.resolveEndPoint(createDto, depot);

      const stops: RouteStopInput[] = routeSheet.route_sheet_detail.map(
        (detail) => ({
          stop_id: detail.route_sheet_detail_id,
          address: this.resolveStopAddress(detail),
          coordinates: this.readStoredCoordinates(detail),
        }),
      );

      const result = await this.routeOptimizer.optimize({
        route_sheet_id,
        depot,
        end_point: endPoint,
        stops,
      });

      const optimization = await this.route_optimization.create({
        data: {
          route_sheet_id,
          estimated_duration: result.estimated_duration_minutes,
          estimated_distance: result.estimated_distance_km,
          optimization_status: 'COMPLETED',
          waypoints: this.buildPersistedWaypoints(
            depot,
            endPoint,
            result.stops,
          ) as any,
        },
      });

      await this.updateRouteSheetDetailsWithOptimizedSequence(
        result.stops.filter((stop) => stop.stop_id !== null),
      );

      return new RouteOptimizationResponseDto({
        optimization_id: optimization.optimization_id,
        route_sheet_id: optimization.route_sheet_id,
        estimated_duration: optimization.estimated_duration,
        estimated_distance: Number(optimization.estimated_distance),
        optimization_status: optimization.optimization_status,
        provider: result.provider,
        is_simulated: result.is_simulated,
        scope: 'FULL',
        waypoints: this.buildPersistedWaypoints(
          depot,
          endPoint,
          result.stops,
        ) as WaypointDto[],
        created_at: formatBATimestampISO(optimization.created_at),
      });
    } catch (error) {
      // NotFound, 422 por coordenadas faltantes, 503 si el servicio de ruteo
      // no responde: se devuelven tal cual al cliente.
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('Error al optimizar la ruta:', error);
      throw new InternalServerErrorException('Error al optimizar la ruta');
    }
  }

  /**
   * Optimización manual de una hoja en curso o pausada: reordena solo las
   * pendientes posteriores a la parada actual. Distancia y duración son las del
   * tramo que falta, desde la parada actual.
   */
  private async optimizePendingRoute(
    route_sheet_id: number,
  ): Promise<RouteOptimizationResponseDto> {
    const outcome = await this.reorderPendingStops(route_sheet_id);
    if (outcome.status === 'NOTHING_TO_REORDER') {
      throw new ConflictException(
        'La hoja está en curso y no hay paradas pendientes para reordenar después de la parada actual.',
      );
    }
    if (outcome.status === 'CONCURRENT_CHANGES') {
      throw new ConflictException(
        'La hoja cambió mientras se calculaba el recorrido. Volvé a intentar.',
      );
    }

    const { result, start, endPoint, fixedCount } = outcome;
    const stops = result.stops.map((stop) => ({
      ...stop,
      sequence_number: stop.sequence_number + fixedCount,
    }));
    const waypoints = this.buildPersistedWaypoints(
      start,
      endPoint,
      stops,
      'Parada actual',
    );
    const optimization = await this.route_optimization.create({
      data: {
        route_sheet_id,
        estimated_duration: result.estimated_duration_minutes,
        estimated_distance: result.estimated_distance_km,
        optimization_status: 'COMPLETED',
        waypoints: waypoints as unknown as Prisma.InputJsonValue,
      },
    });

    return new RouteOptimizationResponseDto({
      optimization_id: optimization.optimization_id,
      route_sheet_id: optimization.route_sheet_id,
      estimated_duration: optimization.estimated_duration,
      estimated_distance: Number(optimization.estimated_distance),
      optimization_status: optimization.optimization_status,
      provider: result.provider,
      is_simulated: result.is_simulated,
      scope: 'PENDING',
      waypoints,
      created_at: formatBATimestampISO(optimization.created_at),
    });
  }

  /**
   * Reordena una hoja después de agregarle paradas extra.
   *
   * - PLANNED: optimiza el recorrido completo, igual que al crear la hoja.
   * - IN_PROGRESS / PAUSED: las paradas resueltas y la actual quedan donde
   *   están; el resto se reoptimiza saliendo desde la parada actual. Así el
   *   chofer no ve cambiar la parada que tiene adelante.
   *
   * Si el chofer resuelve una parada mientras se calcula, no se pisa su
   * avance: se vuelve a calcular con el estado nuevo (un reintento).
   */
  async reoptimizeAfterExtras(
    route_sheet_id: number,
  ): Promise<ReoptimizationOutcome> {
    const sheet = await this.route_sheet.findUnique({
      where: { route_sheet_id },
      select: { execution_status: true, is_active: true },
    });
    if (!sheet) {
      throw new NotFoundException(
        `Hoja de ruta con ID ${route_sheet_id} no encontrada`,
      );
    }
    if (!sheet.is_active || sheet.execution_status === 'CLOSED') {
      return { mode: 'NONE', reason: 'CLOSED' };
    }
    if (sheet.execution_status === 'PLANNED') {
      const result = await this.optimizeRoute({ route_sheet_id });
      return {
        mode: 'FULL',
        provider: result.provider ?? this.routeOptimizer.provider,
      };
    }

    const outcome = await this.reorderPendingStops(route_sheet_id);
    if (outcome.status === 'APPLIED') {
      return {
        mode: 'PENDING',
        provider: outcome.result.provider,
        reordered: outcome.reordered,
      };
    }
    return { mode: 'NONE', reason: outcome.status };
  }

  /**
   * Reordena las paradas pendientes de una hoja en curso o pausada sin mover
   * las resueltas ni la parada actual: el tramo nuevo sale desde la parada
   * actual. Si el chofer resuelve una parada mientras se calcula, no pisa su
   * avance y vuelve a calcular con el estado nuevo (un reintento).
   */
  private async reorderPendingStops(
    route_sheet_id: number,
  ): Promise<PendingReorder> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const details = await this.route_sheet_detail.findMany({
        where: { route_sheet_id },
        orderBy: DELIVERY_SEQUENCE_ORDER_BY,
        include: {
          order_header: { include: { customer: true } },
          one_off_purchase: { include: { person: true } },
          one_off_purchase_header: { include: { person: true } },
        },
      });

      const { fixed, anchor, reorderable } = splitForReoptimization(details);
      if (!anchor || reorderable.length < 2) {
        return { status: 'NOTHING_TO_REORDER' };
      }

      const depot = this.resolveDepot({ route_sheet_id });
      const start = this.readStoredCoordinates(anchor) ?? depot;
      const endPoint = this.resolveEndPoint({ route_sheet_id }, depot);
      const result = await this.routeOptimizer.optimize({
        route_sheet_id,
        depot: start,
        end_point: endPoint,
        stops: reorderable.map((detail) => ({
          stop_id: detail.route_sheet_detail_id,
          address: this.resolveStopAddress(detail),
          coordinates: this.readStoredCoordinates(detail),
        })),
      });

      const finalOrder = [
        ...fixed.map((detail) => detail.route_sheet_detail_id),
        ...result.stops
          .map((stop) => stop.stop_id)
          .filter((id): id is number => id !== null),
      ];
      const snapshot = new Map(
        details.map((d) => [d.route_sheet_detail_id, d.delivery_status]),
      );

      const applied = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Serializa con otras reoptimizaciones de la misma hoja.
          await tx.$queryRaw`SELECT route_sheet_id FROM route_sheet WHERE route_sheet_id = ${route_sheet_id} FOR UPDATE`;
          const current = await tx.route_sheet_detail.findMany({
            where: { route_sheet_id },
            select: { route_sheet_detail_id: true, delivery_status: true },
          });
          const unchanged =
            current.length === snapshot.size &&
            current.every(
              (d) =>
                snapshot.get(d.route_sheet_detail_id) === d.delivery_status,
            );
          if (!unchanged || finalOrder.length !== current.length) return false;

          const previous = new Map(
            details.map((d) => [d.route_sheet_detail_id, d.sequence_number]),
          );
          for (const [index, detailId] of finalOrder.entries()) {
            if (previous.get(detailId) === index + 1) continue;
            await tx.route_sheet_detail.update({
              where: { route_sheet_detail_id: detailId },
              data: { sequence_number: index + 1 },
            });
          }
          return true;
        },
      );

      if (applied) {
        return {
          status: 'APPLIED',
          result,
          start,
          endPoint,
          fixedCount: fixed.length,
          reordered: reorderable.length,
        };
      }
    }

    return { status: 'CONCURRENT_CHANGES' };
  }

  /**
   * Obtiene la última optimización de una hoja de ruta
   */
  async getRouteOptimization(
    route_sheet_id: number,
  ): Promise<RouteOptimizationResponseDto> {
    const optimization = await this.route_optimization.findFirst({
      where: { route_sheet_id },
      orderBy: { created_at: 'desc' },
    });

    if (!optimization) {
      throw new NotFoundException(
        `No se encontró optimización para la hoja de ruta ${route_sheet_id}`,
      );
    }

    return new RouteOptimizationResponseDto({
      optimization_id: optimization.optimization_id,
      route_sheet_id: optimization.route_sheet_id,
      estimated_duration: optimization.estimated_duration,
      estimated_distance: Number(optimization.estimated_distance),
      optimization_status: optimization.optimization_status,
      provider: this.routeOptimizer.provider,
      is_simulated: this.routeOptimizer.is_simulated,
      waypoints: this.parseWaypoints(optimization.waypoints),
      created_at: formatBATimestampISO(optimization.created_at),
    });
  }

  private parseWaypoints(value: unknown): WaypointDto[] {
    if (Array.isArray(value)) {
      return value as WaypointDto[];
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? (parsed as WaypointDto[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Direccion de la parada.
   *
   * AguaViva admite pedidos, compras unicas y compras unicas con cabecera; el
   * pedido por orden de preferencia es la direccion de entrega declarada y, en
   * su defecto, la registrada en la persona.
   */
  private resolveStopAddress(detail: {
    order_header?: { customer?: { address?: string | null } | null } | null;
    one_off_purchase?: {
      delivery_address?: string | null;
      person?: { address?: string | null } | null;
    } | null;
    one_off_purchase_header?: {
      delivery_address?: string | null;
      person?: { address?: string | null } | null;
    } | null;
  }): string | null {
    if (detail.order_header?.customer?.address) {
      return detail.order_header.customer.address;
    }
    if (detail.one_off_purchase) {
      return (
        detail.one_off_purchase.delivery_address ??
        detail.one_off_purchase.person?.address ??
        null
      );
    }
    if (detail.one_off_purchase_header) {
      return (
        detail.one_off_purchase_header.delivery_address ??
        detail.one_off_purchase_header.person?.address ??
        null
      );
    }
    return null;
  }

  /** Punto de partida: el indicado en la petición o el depósito configurado. */
  private resolveDepot(dto: CreateRouteOptimizationDto): GeoPoint {
    if (dto.start_point) {
      return { lat: dto.start_point.lat, lng: dto.start_point.lng };
    }
    return {
      lat: Number(this.configService.get('app.routeOptimization.depot.lat')),
      lng: Number(this.configService.get('app.routeOptimization.depot.lng')),
    };
  }

  /** Punto de cierre: fin explícito, o el de partida si el recorrido es circular. */
  private resolveEndPoint(
    dto: CreateRouteOptimizationDto,
    depot: GeoPoint,
  ): GeoPoint | null {
    if (dto.end_point) {
      return { lat: dto.end_point.lat, lng: dto.end_point.lng };
    }
    if (dto.start_point) {
      return { lat: dto.start_point.lat, lng: dto.start_point.lng };
    }
    const returnToDepot =
      this.configService.get('app.routeOptimization.returnToDepot') !== false;
    return returnToDepot ? depot : null;
  }

  /** Devuelve las coordenadas guardadas del detalle, o null si no existen. */
  private readStoredCoordinates(detail: {
    lat: unknown;
    lng: unknown;
  }): GeoPoint | null {
    if (detail.lat === null || detail.lat === undefined) {
      return null;
    }
    if (detail.lng === null || detail.lng === undefined) {
      return null;
    }
    const lat = Number(detail.lat);
    const lng = Number(detail.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { lat, lng };
  }

  /** Arma el arreglo de waypoints que se persiste y se devuelve al cliente. */
  private buildPersistedWaypoints(
    depot: GeoPoint,
    endPoint: GeoPoint | null,
    stops: Array<{
      stop_id: number | null;
      sequence_number: number;
      coordinates: GeoPoint;
      coordinate_source: 'DATABASE' | 'SIMULATED';
      address?: string | null;
    }>,
    startLabel = 'Depósito',
  ): WaypointDto[] {
    const waypoints: WaypointDto[] = [
      {
        lat: depot.lat,
        lng: depot.lng,
        address: startLabel,
        coordinate_source: 'DATABASE',
        sequence_number: 0,
      },
    ];

    for (const stop of stops) {
      if (stop.stop_id === null) {
        continue;
      }
      waypoints.push({
        lat: stop.coordinates.lat,
        lng: stop.coordinates.lng,
        route_sheet_detail_id: stop.stop_id,
        address: stop.address ?? undefined,
        coordinate_source: stop.coordinate_source,
        sequence_number: stop.sequence_number,
      });
    }

    if (endPoint) {
      waypoints.push({
        lat: endPoint.lat,
        lng: endPoint.lng,
        address: 'Cierre',
        coordinate_source: 'DATABASE',
        sequence_number: waypoints.length,
      });
    }

    return waypoints;
  }

  /**
   * Persiste el orden calculado.
   *
   * `sequence_number` siempre se guarda porque es lo que consumen las pantallas.
   * Las coordenadas solo se escriben cuando ya eran un dato verificado: una
   * coordenada simulada nunca se guarda en el detalle.
   */
  private async updateRouteSheetDetailsWithOptimizedSequence(
    stops: Array<{
      stop_id: number | null;
      sequence_number: number;
      coordinates: GeoPoint;
      coordinate_source: 'DATABASE' | 'SIMULATED';
    }>,
  ): Promise<void> {
    for (const stop of stops) {
      if (stop.stop_id === null) {
        continue;
      }

      const data: {
        sequence_number: number;
        lat?: number;
        lng?: number;
      } = { sequence_number: stop.sequence_number };

      if (stop.coordinate_source === 'DATABASE') {
        data.lat = stop.coordinates.lat;
        data.lng = stop.coordinates.lng;
      }

      await this.route_sheet_detail.update({
        where: { route_sheet_detail_id: stop.stop_id },
        data,
      });
    }
  }
}
