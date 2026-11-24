import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { nowBAYMD } from '../../common/utils/date.utils';
import { RouteSheetService } from '../route-sheet.service';
import { DeliveryCreatedEvent } from './extra-delivery.events';
import { loadDeliveryReference } from './extra-delivery.references';
import {
  EXTRA_SOURCE,
  EXTRA_TARGET_STATUSES,
  pickTargetRouteSheet,
} from './extra-delivery.rules';

export type ExtraDeliveryOutcome =
  | { status: 'ADDED'; route_sheet_id: number }
  | {
      status: 'IGNORED';
      reason:
        | 'NOT_FOUND'
        | 'NOT_DELIVERABLE'
        | 'PAST_DATE'
        | 'NO_ZONE'
        | 'ALREADY_ASSIGNED'
        | 'NO_ROUTE_SHEET'
        | 'CONFLICT'
        | 'REJECTED';
      route_sheet_id?: number;
    };

/**
 * Pedidos extra: cuando administración crea un envío para una fecha que ya
 * tiene hojas de ruta armadas, lo agrega a la hoja del móvil que cubre la zona
 * del cliente y reoptimiza el recorrido pendiente.
 *
 * Si todavía no hay hoja para esa fecha no hace nada: el envío entra en la
 * planificación normal.
 */
@Injectable()
export class ExtraDeliveryService {
  private readonly logger = new Logger(ExtraDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly routeSheetService: RouteSheetService,
  ) {}

  async handleDeliveryCreated(
    event: DeliveryCreatedEvent,
  ): Promise<ExtraDeliveryOutcome> {
    const label = `${event.kind} ${event.id}`;
    const reference = await loadDeliveryReference(this.prisma, event);
    if (!reference) return this.ignore(label, 'NOT_FOUND');
    if (!reference.is_deliverable) return this.ignore(label, 'NOT_DELIVERABLE');
    if (reference.delivery_ymd < nowBAYMD()) {
      return this.ignore(label, 'PAST_DATE');
    }
    if (reference.zone_id === null) return this.ignore(label, 'NO_ZONE');

    const deliveryDate = new Date(`${reference.delivery_ymd}T00:00:00.000Z`);

    // Ya está en una hoja activa de ese día (agregada antes o entregada).
    const existing = await this.prisma.route_sheet_detail.findFirst({
      where: {
        ...reference.detail_where,
        route_sheet: { is_active: true, delivery_date: deliveryDate },
      },
      select: { route_sheet_id: true },
    });
    if (existing) {
      return this.ignore(label, 'ALREADY_ASSIGNED', existing.route_sheet_id);
    }

    const candidates = await this.prisma.route_sheet.findMany({
      where: {
        is_active: true,
        delivery_date: deliveryDate,
        execution_status: { in: EXTRA_TARGET_STATUSES },
        vehicle: {
          vehicle_zone: {
            some: { zone_id: reference.zone_id, is_active: true },
          },
        },
      },
      select: { route_sheet_id: true, execution_status: true },
    });
    const target = pickTargetRouteSheet(candidates);
    if (!target) return this.ignore(label, 'NO_ROUTE_SHEET');

    try {
      await this.routeSheetService.addDetailsIncremental(
        target.route_sheet_id,
        { details: [reference.detail] },
        { source: EXTRA_SOURCE.ORDER_EVENT },
      );
    } catch (error) {
      // Otra hoja lo tomó en paralelo, o la hoja se cerró mientras tanto.
      if (error instanceof ConflictException) {
        return this.ignore(label, 'CONFLICT', target.route_sheet_id);
      }
      // La validación de la hoja no lo acepta (por ejemplo, estado no asignable).
      if (error instanceof BadRequestException) {
        this.logger.warn(
          `${label}: la hoja ${target.route_sheet_id} no lo acepta como extra: ${error.message}`,
        );
        return this.ignore(label, 'REJECTED', target.route_sheet_id);
      }
      throw error;
    }

    this.logger.log(
      `${label} (${reference.delivery_ymd}) agregado como extra a la hoja ${target.route_sheet_id} (${target.execution_status}).`,
    );
    return { status: 'ADDED', route_sheet_id: target.route_sheet_id };
  }

  private ignore(
    label: string,
    reason: Extract<ExtraDeliveryOutcome, { status: 'IGNORED' }>['reason'],
    routeSheetId?: number,
  ): ExtraDeliveryOutcome {
    this.logger.debug(`${label}: no se agrega como extra (${reason}).`);
    return {
      status: 'IGNORED',
      reason,
      ...(routeSheetId !== undefined ? { route_sheet_id: routeSheetId } : {}),
    };
  }
}
