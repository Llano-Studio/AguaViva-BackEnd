import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Estado de la rendición. Se cierra al confirmarla y avanza al recibir el efectivo. */
export enum ReconciliationStatus {
  CONFIRMED = 'CONFIRMED',
  CASH_RECEIVED = 'CASH_RECEIVED',
}

export const RECONCILIATION_STATUSES: ReconciliationStatus[] = [
  ReconciliationStatus.CONFIRMED,
  ReconciliationStatus.CASH_RECEIVED,
];

/**
 * Tipo de movimiento de la cuenta del chofer. `CASH_COLLECTED` suma deuda (el
 * chofer retuvo efectivo que debe rendir), `CASH_RENDERED` la baja (rindió el
 * efectivo) y `ADJUSTMENT` la corrige con un monto firmado.
 */
export enum DriverAccountMovementType {
  CASH_COLLECTED = 'CASH_COLLECTED',
  CASH_RENDERED = 'CASH_RENDERED',
  ADJUSTMENT = 'ADJUSTMENT',
}

export const DRIVER_ACCOUNT_MOVEMENT_TYPES: DriverAccountMovementType[] = [
  DriverAccountMovementType.CASH_COLLECTED,
  DriverAccountMovementType.CASH_RENDERED,
  DriverAccountMovementType.ADJUSTMENT,
];

/** Motivo autorizado de un ajuste manual sobre la cuenta o la rendición. */
export enum ReconciliationAdjustmentReason {
  COUNT_DIFFERENCE = 'COUNT_DIFFERENCE',
  CASH_DIFFERENCE = 'CASH_DIFFERENCE',
  BONUS = 'BONUS',
  PENALTY = 'PENALTY',
  OTHER = 'OTHER',
}

export const RECONCILIATION_ADJUSTMENT_REASONS: ReconciliationAdjustmentReason[] =
  [
    ReconciliationAdjustmentReason.COUNT_DIFFERENCE,
    ReconciliationAdjustmentReason.CASH_DIFFERENCE,
    ReconciliationAdjustmentReason.BONUS,
    ReconciliationAdjustmentReason.PENALTY,
    ReconciliationAdjustmentReason.OTHER,
  ];

/** Conteo físico que el chofer informa para un producto. */
export class ReconciliationCountedItemDto {
  @ApiProperty({ description: 'ID del producto', example: 4 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  product_id: number;

  @ApiProperty({ description: 'Unidades contadas físicamente', example: 12 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  counted_quantity: number;
}

/** Resumen por producto de la hoja rendida. */
export class ReconciliationProductItemDto {
  @ApiProperty({ example: 4 })
  product_id: number;

  @ApiProperty({ example: 'Bidón 20L retornable' })
  description: string;

  @ApiProperty({ description: 'Cargado y recargas (Σ LOAD)', example: 100 })
  loaded_quantity: number;

  @ApiProperty({ description: 'Entregado / vendido (Σ DELIVERY)', example: 60 })
  delivered_quantity: number;

  @ApiProperty({
    description: 'Devoluciones registradas (Σ RETURN)',
    example: 30,
  })
  returned_quantity: number;

  @ApiProperty({
    description: 'Lo que debería quedar en el camión: cargado menos entregado',
    example: 40,
  })
  expected_remaining: number;

  @ApiPropertyOptional({
    description: 'Conteo físico informado por el chofer',
    nullable: true,
    example: 38,
  })
  counted_quantity: number | null;

  @ApiPropertyOptional({
    description: 'Conteo menos lo esperado. Se expone solo si hubo conteo',
    nullable: true,
    example: -2,
  })
  difference_quantity: number | null;
}

/** Cobros consolidados por método de pago. */
export class ReconciliationCollectionDto {
  @ApiProperty({ example: 'EFECTIVO' })
  payment_method: string;

  @ApiProperty({ example: '15000.00' })
  amount: string;
}

/** Totales de la rendición. */
export class ReconciliationTotalsDto {
  @ApiProperty({ description: 'Total cobrado en la hoja', example: '18000.00' })
  total_collected: string;

  @ApiProperty({
    description: 'Efectivo a rendir (solo método EFECTIVO)',
    example: '15000.00',
  })
  cash_to_render: string;

  @ApiProperty({ description: 'Cobros electrónicos', example: '3000.00' })
  electronic_total: string;
}

/** Diferencia de conteo de un producto. */
export class ReconciliationDifferenceDto {
  @ApiProperty({ example: 4 })
  product_id: number;

  @ApiProperty({ example: 'Bidón 20L retornable' })
  description: string;

  @ApiProperty({ example: 40 })
  expected_quantity: number;

  @ApiProperty({ example: 38 })
  counted_quantity: number;

  @ApiProperty({ example: -2 })
  difference: number;
}

/** Snapshot auditable de la rendición. */
export class RouteReconciliationDto {
  @ApiProperty({ example: 501 })
  reconciliation_id: number;

  @ApiProperty({ example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: 12 })
  driver_id: number;

  @ApiPropertyOptional({ nullable: true, example: 'Juan Pérez' })
  driver_name: string | null;

  @ApiProperty({ enum: ReconciliationStatus })
  status: ReconciliationStatus;

  @ApiProperty({ type: [ReconciliationCollectionDto] })
  collections: ReconciliationCollectionDto[];

  @ApiProperty({ type: ReconciliationTotalsDto })
  totals: ReconciliationTotalsDto;

  @ApiProperty({ type: [ReconciliationProductItemDto] })
  products: ReconciliationProductItemDto[];

  @ApiProperty({ type: [ReconciliationDifferenceDto] })
  differences: ReconciliationDifferenceDto[];

  @ApiProperty({ example: 'a1b2c3d4e5f60718' })
  version: string;

  @ApiPropertyOptional({ nullable: true, description: 'URL de la firma' })
  signature_url: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-10-20T18:30:00-03:00' })
  confirmed_at: string;

  @ApiPropertyOptional({ nullable: true })
  received_at: string | null;

  @ApiPropertyOptional({ nullable: true })
  received_by: number | null;

  @ApiProperty({
    description:
      'true si la rendición ya existía y se devolvió sin volver a aplicarla',
    example: false,
  })
  idempotent_replay: boolean;
}

/** Previsualización de la rendición: lo que el chofer revisa antes de confirmar. */
export class RouteReconciliationPreviewDto {
  @ApiProperty({ example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: 12 })
  driver_id: number;

  @ApiProperty({ example: 'IN_PROGRESS' })
  execution_status: string;

  @ApiProperty({ example: '2026-10-20' })
  delivery_date: string;

  @ApiProperty({
    description:
      'Hash del estado de la rendición. Debe viajar de vuelta al confirmar',
    example: 'a1b2c3d4e5f60718',
  })
  version: string;

  @ApiProperty({
    description: 'Se puede confirmar: no quedan paradas sin resolver',
    example: true,
  })
  can_confirm: boolean;

  @ApiProperty({ description: 'Paradas sin resolver', example: 0 })
  pending_deliveries: number;

  @ApiProperty({
    description: 'Ya existe una rendición confirmada para la hoja',
    example: false,
  })
  already_reconciled: boolean;

  @ApiProperty({ type: [ReconciliationCollectionDto] })
  collections: ReconciliationCollectionDto[];

  @ApiProperty({ type: ReconciliationTotalsDto })
  totals: ReconciliationTotalsDto;

  @ApiProperty({ type: [ReconciliationProductItemDto] })
  products: ReconciliationProductItemDto[];

  @ApiProperty({ type: [ReconciliationDifferenceDto] })
  differences: ReconciliationDifferenceDto[];

  @ApiPropertyOptional({
    type: () => RouteReconciliationDto,
    nullable: true,
    description: 'Snapshot ya confirmado, si la hoja ya fue rendida',
  })
  reconciliation: RouteReconciliationDto | null;
}

/** Confirmación de la rendición por el chofer. */
export class ConfirmRouteReconciliationDto {
  @ApiPropertyOptional({
    description:
      'Firma de conformidad del chofer como data URI base64 (data:image/png;base64,...)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
  })
  @IsOptional()
  @IsString()
  signature?: string;

  @ApiPropertyOptional({
    description: 'Conteo físico por producto. Opcional: sin él no hay diferencias',
    type: [ReconciliationCountedItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReconciliationCountedItemDto)
  counted_items?: ReconciliationCountedItemDto[];

  @ApiPropertyOptional({ description: 'Notas de la rendición' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({
    description:
      'Clave de idempotencia de la confirmación. Reintentar con la misma clave devuelve la rendición ya registrada.',
    example: '9a1c2f7a-1b2c-4d5e-9f10-2a3b4c5d6e7f',
  })
  @IsString()
  @MaxLength(80)
  idempotency_key: string;

  @ApiProperty({
    description: 'Versión de la previsualización que el chofer tenía a la vista',
    example: 'a1b2c3d4e5f60718',
  })
  @IsString()
  @MaxLength(64)
  version: string;
}

/** Movimiento inmutable de la cuenta del chofer. */
export class DriverAccountMovementDto {
  @ApiProperty({ example: 9001 })
  movement_id: number;

  @ApiProperty({ enum: DriverAccountMovementType })
  movement_type: DriverAccountMovementType;

  @ApiProperty({
    description: 'Monto firmado: positivo aumenta la deuda del chofer',
    example: '15000.00',
  })
  amount: string;

  @ApiPropertyOptional({ nullable: true, example: 345 })
  route_sheet_id: number | null;

  @ApiPropertyOptional({ nullable: true, example: 501 })
  reconciliation_id: number | null;

  @ApiPropertyOptional({ nullable: true })
  reference: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-10-20T18:30:00-03:00' })
  created_at: string;
}

/** Cuenta corriente del chofer: saldo reconstruido desde los movimientos. */
export class DriverAccountDto {
  @ApiProperty({ example: 12 })
  driver_id: number;

  @ApiProperty({
    description: 'Saldo actual. Positivo = el chofer debe a la empresa',
    example: '15000.00',
  })
  balance: string;

  @ApiProperty({
    description: 'Total acumulado que aumenta la deuda',
    example: '15000.00',
  })
  total_debit: string;

  @ApiProperty({
    description: 'Total acumulado que la reduce',
    example: '0.00',
  })
  total_credit: string;

  @ApiProperty({ type: [DriverAccountMovementDto] })
  movements: DriverAccountMovementDto[];

  @ApiProperty({
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 50 },
      total: { type: 'number', example: 3 },
      total_pages: { type: 'number', example: 1 },
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/** Consulta paginada de la cuenta del chofer. */
export class FilterDriverAccountDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

/** Consulta del listado de rendiciones (admin). */
export class FilterRouteReconciliationsDto {
  @ApiPropertyOptional({ description: 'Filtrar por chofer', example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  driver_id?: number;

  @ApiPropertyOptional({ enum: ReconciliationStatus })
  @IsOptional()
  @IsIn(RECONCILIATION_STATUSES)
  status?: ReconciliationStatus;

  @ApiPropertyOptional({
    description: 'Desde (YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Hasta (YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

/** Fila del listado de rendiciones (admin). */
export class RouteReconciliationListItemDto {
  @ApiProperty({ example: 501 })
  reconciliation_id: number;

  @ApiProperty({ example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: 12 })
  driver_id: number;

  @ApiPropertyOptional({ nullable: true, example: 'Juan Pérez' })
  driver_name: string | null;

  @ApiProperty({ example: '2026-10-20' })
  delivery_date: string;

  @ApiProperty({ enum: ReconciliationStatus })
  status: ReconciliationStatus;

  @ApiProperty({ type: ReconciliationTotalsDto })
  totals: ReconciliationTotalsDto;

  @ApiProperty({ example: '2026-10-20T18:30:00-03:00' })
  confirmed_at: string;

  @ApiPropertyOptional({ nullable: true })
  received_at: string | null;
}

/** Listado paginado de rendiciones. */
export class RouteReconciliationListDto {
  @ApiProperty({ type: [RouteReconciliationListItemDto] })
  items: RouteReconciliationListItemDto[];

  @ApiProperty({
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 },
      total: { type: 'number', example: 8 },
      total_pages: { type: 'number', example: 1 },
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

/** Recepción del efectivo rendido por el chofer. */
export class ReceiveCashDto {
  @ApiProperty({
    description: 'Efectivo recibido',
    example: 15000,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Notas de la recepción' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({
    description: 'Clave de idempotencia de la recepción',
    example: 'c3d4e5f6-1b2c-4d5e-9f10-2a3b4c5d6e7f',
  })
  @IsString()
  @MaxLength(80)
  idempotency_key: string;
}

/** Ajuste manual sobre la cuenta del chofer. */
export class ReconciliationAdjustmentDto {
  @ApiProperty({
    description: 'Monto firmado: positivo aumenta la deuda, negativo la reduce',
    example: -500,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  amount: number;

  @ApiProperty({ enum: ReconciliationAdjustmentReason })
  @IsIn(RECONCILIATION_ADJUSTMENT_REASONS)
  reason: ReconciliationAdjustmentReason;

  @ApiPropertyOptional({ description: 'Detalle del ajuste' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({
    description: 'Clave de idempotencia del ajuste',
    example: 'd4e5f6a7-1b2c-4d5e-9f10-2a3b4c5d6e7f',
  })
  @IsString()
  @MaxLength(80)
  idempotency_key: string;
}
