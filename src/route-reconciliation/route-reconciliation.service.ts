import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Prisma, RouteSheetExecutionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildImageUrl } from '../common/utils/file-upload.util';
import {
  endOfDayBA,
  formatBATimestampISO,
  formatBAYMD,
  parseBAYMD,
} from '../common/utils/date.utils';
import {
  OPEN_EXECUTION_STATUSES,
  RESOLVED_DELIVERY_STATUSES,
} from '../route-sheet/delivery-locks';
import {
  ConfirmRouteReconciliationDto,
  DriverAccountDto,
  DriverAccountMovementDto,
  DriverAccountMovementType,
  FilterDriverAccountDto,
  FilterRouteReconciliationsDto,
  ReceiveCashDto,
  ReconciliationAdjustmentDto,
  ReconciliationAdjustmentReason,
  ReconciliationCollectionDto,
  ReconciliationCountedItemDto,
  ReconciliationDifferenceDto,
  ReconciliationProductItemDto,
  ReconciliationStatus,
  ReconciliationTotalsDto,
  RouteReconciliationDto,
  RouteReconciliationListDto,
  RouteReconciliationPreviewDto,
} from './dto';

/** Método de pago cuyo efectivo el chofer debe rendir. */
const CASH_METHOD_CODE = 'EFECTIVO';

/** Tipos de movimiento de inventario que arma el resumen por producto. */
const INVENTORY_LOAD = 'LOAD';
const INVENTORY_DELIVERY = 'DELIVERY';
const INVENTORY_RETURN = 'RETURN';

const SIGNATURE_FOLDER = 'reconciliations';
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const SIGNATURE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
};

const RECONCILIATION_INCLUDE = {
  driver: { select: { id: true, name: true } },
} satisfies Prisma.route_reconciliationInclude;

type ReconciliationRow = Prisma.route_reconciliationGetPayload<{
  include: typeof RECONCILIATION_INCLUDE;
}>;

interface CollectionsBreakdown {
  collections: ReconciliationCollectionDto[];
  totals: ReconciliationTotalsDto;
}

/** Snapshot calculado antes de persistir la rendición. */
interface ReconciledSnapshot {
  collections: ReconciliationCollectionDto[];
  totals: ReconciliationTotalsDto;
  products: ReconciliationProductItemDto[];
  differences: ReconciliationDifferenceDto[];
  version: string;
  pendingDeliveries: number;
}

@Injectable()
export class RouteReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Previsualización de la rendición: cobros por método, efectivo a rendir y
   * resumen por producto. Incluye la `version` que el chofer debe devolver al
   * confirmar, para detectar que trabajó con datos obsoletos.
   */
  async previewForDriver(
    driverId: number,
    routeSheetId: number,
  ): Promise<RouteReconciliationPreviewDto> {
    const sheet = await this.loadOwnedSheet(driverId, routeSheetId);
    const snapshot = await this.buildSnapshot(sheet, new Map());
    const existing = await this.prisma.route_reconciliation.findUnique({
      where: { route_sheet_id: routeSheetId },
      include: RECONCILIATION_INCLUDE,
    });

    return {
      route_sheet_id: routeSheetId,
      driver_id: sheet.driver_id,
      execution_status: sheet.execution_status,
      delivery_date: formatBAYMD(sheet.delivery_date),
      version: snapshot.version,
      can_confirm:
        snapshot.pendingDeliveries === 0 &&
        existing === null &&
        OPEN_EXECUTION_STATUSES.includes(sheet.execution_status),
      pending_deliveries: snapshot.pendingDeliveries,
      already_reconciled: existing !== null,
      collections: snapshot.collections,
      totals: snapshot.totals,
      products: snapshot.products,
      differences: snapshot.differences,
      reconciliation: existing ? this.toSnapshot(existing, true) : null,
    };
  }

  /**
   * Confirma la rendición y cierra la hoja. Es idempotente por `idempotency_key`:
   * reintentar con la misma clave devuelve el snapshot ya creado. Antes de
   * escribir revalida que no queden paradas pendientes y que la `version` siga
   * vigente, para que no se cierre sobre datos que cambiaron.
   */
  async confirmByDriver(
    driverId: number,
    routeSheetId: number,
    dto: ConfirmRouteReconciliationDto,
  ): Promise<RouteReconciliationDto> {
    const sheet = await this.loadOwnedSheet(driverId, routeSheetId);

    const existing = await this.prisma.route_reconciliation.findUnique({
      where: { route_sheet_id: routeSheetId },
      include: RECONCILIATION_INCLUDE,
    });
    if (existing) {
      if (existing.idempotency_key === dto.idempotency_key) {
        return this.toSnapshot(existing, true);
      }
      throw new ConflictException(
        `La hoja de ruta ${routeSheetId} ya fue rendida`,
      );
    }

    if (sheet.reconciliation_at) {
      throw new ConflictException(
        `La hoja de ruta ${routeSheetId} ya fue rendida`,
      );
    }
    if (!OPEN_EXECUTION_STATUSES.includes(sheet.execution_status)) {
      throw new ConflictException(
        `La hoja de ruta no está en curso (estado ${sheet.execution_status})`,
      );
    }

    const counted = this.normalizeCounted(dto.counted_items);
    const snapshot = await this.buildSnapshot(sheet, counted);
    if (snapshot.pendingDeliveries > 0) {
      throw new ConflictException(
        `Quedan ${snapshot.pendingDeliveries} paradas sin resolver. Resolvelas antes de rendir la hoja.`,
      );
    }
    if (dto.version !== snapshot.version) {
      throw new ConflictException(
        'La rendición cambió desde la última consulta. Actualizá e intentá de nuevo.',
      );
    }

    const signaturePath = dto.signature
      ? await this.saveSignatureFile(dto.signature, routeSheetId)
      : null;
    const cashToRender = new Prisma.Decimal(snapshot.totals.cash_to_render);
    const fullyReceived = cashToRender.lte(0);

    let created: ReconciliationRow;
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const reconciliation = await tx.route_reconciliation.create({
          data: {
            route_sheet_id: routeSheetId,
            driver_id: driverId,
            status: fullyReceived
              ? ReconciliationStatus.CASH_RECEIVED
              : ReconciliationStatus.CONFIRMED,
            cash_to_render: snapshot.totals.cash_to_render,
            electronic_total: snapshot.totals.electronic_total,
            total_collected: snapshot.totals.total_collected,
            collections_by_method:
              snapshot.collections as unknown as Prisma.InputJsonValue,
            product_summary:
              snapshot.products as unknown as Prisma.InputJsonValue,
            differences:
              snapshot.differences as unknown as Prisma.InputJsonValue,
            version: snapshot.version,
            signature_path: signaturePath,
            idempotency_key: dto.idempotency_key,
            notes: dto.notes ?? null,
          },
          include: RECONCILIATION_INCLUDE,
        });

        if (!fullyReceived) {
          await tx.driver_account_movement.create({
            data: {
              driver_id: driverId,
              movement_type: DriverAccountMovementType.CASH_COLLECTED,
              amount: snapshot.totals.cash_to_render,
              route_sheet_id: routeSheetId,
              reconciliation_id: reconciliation.reconciliation_id,
              reference: `RS-${routeSheetId}`,
              origin_key: `RECONCILIATION:${routeSheetId}`,
              notes: 'Efectivo cobrado en la hoja de ruta',
              created_by: driverId,
            },
          });
        }

        await tx.route_sheet.update({
          where: { route_sheet_id: routeSheetId },
          data: {
            reconciliation_at: new Date(),
            driver_reconciliation_signature_path: signaturePath,
            execution_status: RouteSheetExecutionStatus.CLOSED,
            closed_at: new Date(),
          },
        });

        return reconciliation;
      });
    } catch (error) {
      if (signaturePath) {
        await fs
          .remove(path.join(this.signatureDir(), signaturePath))
          .catch(() => undefined);
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.route_reconciliation.findUnique({
          where: { route_sheet_id: routeSheetId },
          include: RECONCILIATION_INCLUDE,
        });
        if (raced && raced.idempotency_key === dto.idempotency_key) {
          return this.toSnapshot(raced, true);
        }
        throw new ConflictException(
          `La hoja de ruta ${routeSheetId} ya fue rendida`,
        );
      }
      throw error;
    }

    return this.toSnapshot(created, false);
  }

  /** Snapshot de una rendición por su ID (chofer o administrador). */
  async findById(reconciliationId: number): Promise<RouteReconciliationDto> {
    const row = await this.prisma.route_reconciliation.findUnique({
      where: { reconciliation_id: reconciliationId },
      include: RECONCILIATION_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException(
        `Rendición ${reconciliationId} no encontrada`,
      );
    }
    return this.toSnapshot(row, false);
  }

  /** Listado paginado de rendiciones para administración. */
  async findAll(
    filters: FilterRouteReconciliationsDto,
  ): Promise<RouteReconciliationListDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where: Prisma.route_reconciliationWhereInput = {};
    if (filters.driver_id) where.driver_id = filters.driver_id;
    if (filters.status) where.status = filters.status;
    if (filters.date_from || filters.date_to) {
      const confirmedAt: Prisma.DateTimeFilter = {};
      if (filters.date_from) confirmedAt.gte = parseBAYMD(filters.date_from);
      if (filters.date_to) confirmedAt.lte = endOfDayBA(parseBAYMD(filters.date_to));
      where.confirmed_at = confirmedAt;
    }

    const [total, rows] = await Promise.all([
      this.prisma.route_reconciliation.count({ where }),
      this.prisma.route_reconciliation.findMany({
        where,
        include: {
          ...RECONCILIATION_INCLUDE,
          route_sheet: { select: { delivery_date: true } },
        },
        orderBy: [
          { confirmed_at: 'desc' },
          { reconciliation_id: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => {
        const totals = this.readTotals(row);
        return {
          reconciliation_id: row.reconciliation_id,
          route_sheet_id: row.route_sheet_id,
          driver_id: row.driver_id,
          driver_name: row.driver?.name ?? null,
          delivery_date: row.route_sheet
            ? formatBAYMD(row.route_sheet.delivery_date)
            : '',
          status: row.status as ReconciliationStatus,
          totals,
          confirmed_at: formatBATimestampISO(row.confirmed_at),
          received_at: row.received_at
            ? formatBATimestampISO(row.received_at)
            : null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  /**
   * Recepción del efectivo rendido. Registra el movimiento que baja la deuda del
   * chofer y, cuando se completó el monto a rendir, marca la rendición como
   * cobrada. Idempotente por `idempotency_key`.
   */
  async receiveCash(
    adminId: number,
    reconciliationId: number,
    dto: ReceiveCashDto,
  ): Promise<RouteReconciliationDto> {
    const reconciliation = await this.requireReconciliation(reconciliationId);
    const originKey = `CASH_RECEIVED:${reconciliationId}:${dto.idempotency_key}`;

    const replay = await this.prisma.driver_account_movement.findUnique({
      where: { origin_key: originKey },
    });
    if (replay) {
      return this.findById(reconciliationId);
    }

    const alreadyRendered = await this.sumRenderedCash(reconciliationId);
    const pending = new Prisma.Decimal(reconciliation.cash_to_render).minus(
      alreadyRendered,
    );
    const received = new Prisma.Decimal(dto.amount);
    if (received.gt(pending)) {
      throw new ConflictException(
        `El efectivo pendiente de rendir es ${pending.toFixed(2)}`,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.driver_account_movement.create({
          data: {
            driver_id: reconciliation.driver_id,
            movement_type: DriverAccountMovementType.CASH_RENDERED,
            amount: received.neg().toFixed(2),
            route_sheet_id: reconciliation.route_sheet_id,
            reconciliation_id: reconciliationId,
            reference: `RS-${reconciliation.route_sheet_id}`,
            origin_key: originKey,
            notes: dto.notes ?? null,
            created_by: adminId,
          },
        });

        const totalRendered = alreadyRendered.add(received);
        const fullyReceived = totalRendered.gte(
          new Prisma.Decimal(reconciliation.cash_to_render),
        );
        await tx.route_reconciliation.update({
          where: { reconciliation_id: reconciliationId },
          data: {
            received_at: reconciliation.received_at ?? new Date(),
            received_by: reconciliation.received_by ?? adminId,
            status: fullyReceived
              ? ReconciliationStatus.CASH_RECEIVED
              : reconciliation.status,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.findById(reconciliationId);
      }
      throw error;
    }

    return this.findById(reconciliationId);
  }

  /**
   * Ajuste manual de la cuenta del chofer con motivo auditado. El monto es
   * firmado: positivo aumenta la deuda, negativo la reduce. Idempotente por
   * `idempotency_key`.
   */
  async registerAdjustment(
    adminId: number,
    reconciliationId: number,
    dto: ReconciliationAdjustmentDto,
  ): Promise<RouteReconciliationDto> {
    const reconciliation = await this.requireReconciliation(reconciliationId);
    const originKey = `ADJUSTMENT:${reconciliationId}:${dto.idempotency_key}`;

    const replay = await this.prisma.driver_account_movement.findUnique({
      where: { origin_key: originKey },
    });
    if (replay) {
      return this.findById(reconciliationId);
    }

    try {
      await this.prisma.driver_account_movement.create({
        data: {
          driver_id: reconciliation.driver_id,
          movement_type: DriverAccountMovementType.ADJUSTMENT,
          amount: new Prisma.Decimal(dto.amount).toFixed(2),
          route_sheet_id: reconciliation.route_sheet_id,
          reconciliation_id: reconciliationId,
          reference: dto.reason as ReconciliationAdjustmentReason,
          origin_key: originKey,
          notes: dto.notes ?? null,
          created_by: adminId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.findById(reconciliationId);
      }
      throw error;
    }

    return this.findById(reconciliationId);
  }

  /** Cuenta corriente del chofer: saldo reconstruido sumando los movimientos. */
  async getDriverAccount(
    driverId: number,
    filters: FilterDriverAccountDto,
  ): Promise<DriverAccountDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    const [total, rows, debits, credits] = await Promise.all([
      this.prisma.driver_account_movement.count({
        where: { driver_id: driverId },
      }),
      this.prisma.driver_account_movement.findMany({
        where: { driver_id: driverId },
        orderBy: [{ created_at: 'desc' }, { movement_id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driver_account_movement.aggregate({
        where: { driver_id: driverId, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      this.prisma.driver_account_movement.aggregate({
        where: { driver_id: driverId, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
    ]);

    const totalDebit = new Prisma.Decimal(debits._sum.amount ?? 0);
    const totalCredit = new Prisma.Decimal(credits._sum.amount ?? 0);
    const balance = totalDebit.add(totalCredit);

    return {
      driver_id: driverId,
      balance: balance.toFixed(2),
      total_debit: totalDebit.toFixed(2),
      total_credit: totalCredit.abs().toFixed(2),
      movements: rows.map((row) => this.toMovement(row)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  }

  /** Resumen de una rendición: cobros por método y saldo de efectivo a rendir. */
  private async buildCollections(
    detailIds: number[],
  ): Promise<CollectionsBreakdown> {
    if (detailIds.length === 0) {
      return {
        collections: [],
        totals: {
          total_collected: '0.00',
          cash_to_render: '0.00',
          electronic_total: '0.00',
        },
      };
    }

    const payments = await this.prisma.payment_transaction.findMany({
      where: { route_sheet_detail_id: { in: detailIds }, is_active: true },
      select: {
        transaction_amount: true,
        payment_method: { select: { code: true } },
      },
    });

    const byMethod = new Map<string, Prisma.Decimal>();
    let total = new Prisma.Decimal(0);
    let cash = new Prisma.Decimal(0);
    for (const payment of payments) {
      const code = payment.payment_method.code;
      const amount = new Prisma.Decimal(payment.transaction_amount);
      byMethod.set(
        code,
        (byMethod.get(code) ?? new Prisma.Decimal(0)).add(amount),
      );
      total = total.add(amount);
      if (code === CASH_METHOD_CODE) cash = cash.add(amount);
    }

    // Orden estable por código de método para que la respuesta no varíe.
    const collections = [...byMethod.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([payment_method, amount]) => ({
        payment_method,
        amount: amount.toFixed(2),
      }));

    return {
      collections,
      totals: {
        total_collected: total.toFixed(2),
        cash_to_render: cash.toFixed(2),
        electronic_total: total.minus(cash).toFixed(2),
      },
    };
  }

  /**
   * Resumen por producto: cargado, entregado y devuelto salen de los
   * movimientos de inventario; el conteo físico lo aporta el chofer y la
   * diferencia es el conteo menos lo esperado (cargado menos entregado menos
   * devuelto).
   */
  private async buildProductSummary(
    routeSheetId: number,
    counted: Map<number, number>,
  ): Promise<{
    products: ReconciliationProductItemDto[];
    differences: ReconciliationDifferenceDto[];
  }> {
    const [inventory, transactions] = await Promise.all([
      this.prisma.vehicle_route_inventory.findMany({
        where: { route_sheet_id: routeSheetId },
        include: { product: { select: { description: true } } },
        orderBy: { product_id: 'asc' },
      }),
      this.prisma.inventory_transaction.findMany({
        where: { route_sheet_id: routeSheetId },
        select: { product_id: true, quantity: true, transaction_type: true },
      }),
    ]);

    const descriptions = new Map<number, string>();
    const loaded = new Map<number, number>();
    const delivered = new Map<number, number>();
    const returned = new Map<number, number>();
    const productIds = new Set<number>();

    for (const item of inventory) {
      descriptions.set(item.product_id, item.product.description);
      productIds.add(item.product_id);
    }
    for (const tx of transactions) {
      productIds.add(tx.product_id);
      if (tx.transaction_type === INVENTORY_LOAD) {
        loaded.set(tx.product_id, (loaded.get(tx.product_id) ?? 0) + tx.quantity);
      } else if (tx.transaction_type === INVENTORY_DELIVERY) {
        delivered.set(
          tx.product_id,
          (delivered.get(tx.product_id) ?? 0) + Math.abs(tx.quantity),
        );
      } else if (tx.transaction_type === INVENTORY_RETURN) {
        returned.set(
          tx.product_id,
          (returned.get(tx.product_id) ?? 0) + tx.quantity,
        );
      }
    }

    const missing = [...productIds].filter((id) => !descriptions.has(id));
    if (missing.length > 0) {
      const products = await this.prisma.product.findMany({
        where: { product_id: { in: missing } },
        select: { product_id: true, description: true },
      });
      for (const product of products) {
        descriptions.set(product.product_id, product.description);
      }
    }

    const products: ReconciliationProductItemDto[] = [];
    const differences: ReconciliationDifferenceDto[] = [];

    for (const productId of [...productIds].sort((a, b) => a - b)) {
      const loadedQty = loaded.get(productId) ?? 0;
      const deliveredQty = delivered.get(productId) ?? 0;
      const returnedQty = returned.get(productId) ?? 0;
      const expected = loadedQty - deliveredQty - returnedQty;
      const countedQty = counted.has(productId)
        ? (counted.get(productId) as number)
        : null;
      const difference = countedQty === null ? null : countedQty - expected;

      products.push({
        product_id: productId,
        description: descriptions.get(productId) ?? '',
        loaded_quantity: loadedQty,
        delivered_quantity: deliveredQty,
        returned_quantity: returnedQty,
        expected_remaining: expected,
        counted_quantity: countedQty,
        difference_quantity: difference,
      });

      if (difference !== null && difference !== 0) {
        differences.push({
          product_id: productId,
          description: descriptions.get(productId) ?? '',
          expected_quantity: expected,
          counted_quantity: countedQty,
          difference,
        });
      }
    }

    return { products, differences };
  }

  /** Arma el snapshot completo de la hoja (cobros, productos y diferencias). */
  private async buildSnapshot(
    sheet: OwnedSheet,
    counted: Map<number, number>,
  ): Promise<ReconciledSnapshot> {
    const detailIds = sheet.route_sheet_detail.map(
      (detail) => detail.route_sheet_detail_id,
    );
    const pendingDeliveries = sheet.route_sheet_detail.filter(
      (detail) => !RESOLVED_DELIVERY_STATUSES.has(detail.delivery_status),
    ).length;

    const [collectionsBreakdown, productSummary] = await Promise.all([
      this.buildCollections(detailIds),
      this.buildProductSummary(sheet.route_sheet_id, counted),
    ]);

    const version = this.buildVersion({
      route_sheet_id: sheet.route_sheet_id,
      execution_status: sheet.execution_status,
      pending_deliveries: pendingDeliveries,
      collections: collectionsBreakdown.collections,
      products: productSummary.products,
    });

    return {
      collections: collectionsBreakdown.collections,
      totals: collectionsBreakdown.totals,
      products: productSummary.products,
      differences: productSummary.differences,
      version,
      pendingDeliveries,
    };
  }

  /**
   * Hash estable del estado de la rendición. Incluye los cobros y el resumen por
   * producto para que cualquier cambio posterior invalide una confirmación que
   * se armó con datos viejos.
   */
  private buildVersion(input: {
    route_sheet_id: number;
    execution_status: string;
    pending_deliveries: number;
    collections: ReconciliationCollectionDto[];
    products: ReconciliationProductItemDto[];
  }): string {
    const payload = JSON.stringify({
      route_sheet_id: input.route_sheet_id,
      execution_status: input.execution_status,
      pending_deliveries: input.pending_deliveries,
      collections: input.collections.map((c) => [c.payment_method, c.amount]),
      products: input.products.map((p) => [
        p.product_id,
        p.loaded_quantity,
        p.delivered_quantity,
        p.returned_quantity,
      ]),
    });
    return createHash('sha1').update(payload).digest('hex').slice(0, 16);
  }

  /** Une conteos repetidos del mismo producto y los deja en un mapa estable. */
  private normalizeCounted(
    items: ReconciliationCountedItemDto[] | undefined,
  ): Map<number, number> {
    const merged = new Map<number, number>();
    for (const item of items ?? []) {
      merged.set(item.product_id, item.counted_quantity);
    }
    return merged;
  }

  /** Carga la hoja validando que sea del chofer y esté activa. */
  private async loadOwnedSheet(
    driverId: number,
    routeSheetId: number,
  ): Promise<OwnedSheet> {
    const sheet = await this.prisma.route_sheet.findFirst({
      where: {
        route_sheet_id: routeSheetId,
        driver_id: driverId,
        is_active: true,
      },
      select: {
        route_sheet_id: true,
        driver_id: true,
        delivery_date: true,
        execution_status: true,
        reconciliation_at: true,
        route_sheet_detail: {
          select: {
            route_sheet_detail_id: true,
            delivery_status: true,
          },
        },
      },
    });
    if (!sheet) {
      throw new NotFoundException(`Hoja de ruta ${routeSheetId} no encontrada`);
    }
    return sheet;
  }

  private async requireReconciliation(
    reconciliationId: number,
  ): Promise<{
    reconciliation_id: number;
    route_sheet_id: number;
    driver_id: number;
    cash_to_render: Prisma.Decimal;
    status: string;
    received_at: Date | null;
    received_by: number | null;
  }> {
    const row = await this.prisma.route_reconciliation.findUnique({
      where: { reconciliation_id: reconciliationId },
      select: {
        reconciliation_id: true,
        route_sheet_id: true,
        driver_id: true,
        cash_to_render: true,
        status: true,
        received_at: true,
        received_by: true,
      },
    });
    if (!row) {
      throw new NotFoundException(
        `Rendición ${reconciliationId} no encontrada`,
      );
    }
    return row;
  }

  /** Suma del efectivo ya rendido (movimientos negativos) de una rendición. */
  private async sumRenderedCash(reconciliationId: number): Promise<Prisma.Decimal> {
    const result = await this.prisma.driver_account_movement.aggregate({
      where: {
        reconciliation_id: reconciliationId,
        movement_type: DriverAccountMovementType.CASH_RENDERED,
      },
      _sum: { amount: true },
    });
    // Los movimientos de rendición se guardan negativos: el rendido es el valor absoluto.
    return new Prisma.Decimal(result._sum.amount ?? 0).abs();
  }

  private signatureDir(): string {
    return path.join(process.cwd(), 'public', 'uploads', SIGNATURE_FOLDER);
  }

  /**
   * Guarda la firma de conformidad (data URI base64). Devuelve el nombre del
   * archivo, que es lo que se persiste en el snapshot.
   */
  private async saveSignatureFile(
    dataUri: string,
    routeSheetId: number,
  ): Promise<string> {
    const matches = /^data:([A-Za-z-+/]+);base64,(.+)$/.exec(dataUri);
    if (!matches) {
      throw new BadRequestException(
        'La firma debe ser un data URI base64 (data:image/png;base64,...)',
      );
    }
    const extension = SIGNATURE_EXTENSIONS[matches[1]];
    if (!extension) {
      throw new BadRequestException(
        'Formato de firma no soportado: usá PNG o JPEG',
      );
    }
    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length === 0) {
      throw new BadRequestException('La firma está vacía');
    }
    if (buffer.length > MAX_SIGNATURE_BYTES) {
      throw new BadRequestException(
        'La firma supera el tamaño máximo permitido (2 MB)',
      );
    }

    const fileName = `reconciliation_routesheet_${routeSheetId}_${Date.now()}.${extension}`;
    const dir = this.signatureDir();
    await fs.ensureDir(dir);
    await fs.writeFile(path.join(dir, fileName), buffer);
    return fileName;
  }

  private toSnapshot(
    row: ReconciliationRow,
    idempotentReplay: boolean,
  ): RouteReconciliationDto {
    return {
      reconciliation_id: row.reconciliation_id,
      route_sheet_id: row.route_sheet_id,
      driver_id: row.driver_id,
      driver_name: row.driver?.name ?? null,
      status: row.status as ReconciliationStatus,
      collections: (row.collections_by_method ??
        []) as unknown as ReconciliationCollectionDto[],
      totals: this.readTotals(row),
      products: (row.product_summary ??
        []) as unknown as ReconciliationProductItemDto[],
      differences: (row.differences ??
        []) as unknown as ReconciliationDifferenceDto[],
      version: row.version,
      signature_url: buildImageUrl(row.signature_path, SIGNATURE_FOLDER),
      notes: row.notes ?? null,
      confirmed_at: formatBATimestampISO(row.confirmed_at),
      received_at: row.received_at
        ? formatBATimestampISO(row.received_at)
        : null,
      received_by: row.received_by ?? null,
      idempotent_replay: idempotentReplay,
    };
  }

  private readTotals(row: {
    total_collected: Prisma.Decimal;
    cash_to_render: Prisma.Decimal;
    electronic_total: Prisma.Decimal;
  }): ReconciliationTotalsDto {
    return {
      total_collected: new Prisma.Decimal(row.total_collected).toFixed(2),
      cash_to_render: new Prisma.Decimal(row.cash_to_render).toFixed(2),
      electronic_total: new Prisma.Decimal(row.electronic_total).toFixed(2),
    };
  }

  private toMovement(row: {
    movement_id: number;
    movement_type: string;
    amount: Prisma.Decimal;
    route_sheet_id: number | null;
    reconciliation_id: number | null;
    reference: string | null;
    notes: string | null;
    created_at: Date;
  }): DriverAccountMovementDto {
    return {
      movement_id: row.movement_id,
      movement_type: row.movement_type as DriverAccountMovementType,
      amount: new Prisma.Decimal(row.amount).toFixed(2),
      route_sheet_id: row.route_sheet_id ?? null,
      reconciliation_id: row.reconciliation_id ?? null,
      reference: row.reference ?? null,
      notes: row.notes ?? null,
      created_at: formatBATimestampISO(row.created_at),
    };
  }
}

/** Hoja del chofer con el estado de sus paradas, tal como la carga el servicio. */
interface OwnedSheet {
  route_sheet_id: number;
  driver_id: number;
  delivery_date: Date;
  execution_status: RouteSheetExecutionStatus;
  reconciliation_at: Date | null;
  route_sheet_detail: {
    route_sheet_detail_id: number;
    delivery_status: string;
  }[];
}
