import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DriverStopType } from './driver-route-sheet-response.dto';
import {
  DriverDeliveryDetailCustomerDto,
  DriverDeliveryDetailDto,
  DriverDeliveryPaymentDto,
} from './driver-delivery-detail.dto';

/** Motivo autorizado para confirmar una entrega sin la firma del receptor. */
export enum DriverSignatureMissingReason {
  RECIPIENT_ABSENT = 'RECIPIENT_ABSENT',
  RECIPIENT_REFUSED = 'RECIPIENT_REFUSED',
  DEVICE_UNAVAILABLE = 'DEVICE_UNAVAILABLE',
  OTHER = 'OTHER',
}

export const DRIVER_SIGNATURE_MISSING_REASONS: DriverSignatureMissingReason[] =
  [
    DriverSignatureMissingReason.RECIPIENT_ABSENT,
    DriverSignatureMissingReason.RECIPIENT_REFUSED,
    DriverSignatureMissingReason.DEVICE_UNAVAILABLE,
    DriverSignatureMissingReason.OTHER,
  ];

/** Ítem del resumen que el cliente recibe y firma. */
export class DriverDeliverySummaryItemDto {
  @ApiProperty({ example: 4 })
  product_id: number;

  @ApiProperty({ example: 'Bidón 20L retornable' })
  product_description: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 0 })
  delivered_quantity: number;

  @ApiProperty({
    description: 'Cantidad que se entrega ahora: pedida menos ya entregada',
    example: 2,
  })
  pending_quantity: number;

  @ApiProperty({ example: '1200.00' })
  unit_price: string;

  @ApiProperty({ example: '2400.00' })
  subtotal: string;
}

/** Montos del resumen firmado. */
export class DriverDeliverySummaryTotalsDto {
  @ApiProperty({ example: '2400.00' })
  total_amount: string;

  @ApiProperty({ example: '0.00' })
  paid_amount: string;

  @ApiProperty({ example: '2400.00' })
  pending_amount: string;
}

/**
 * Resumen que el cliente revisa y firma antes de confirmar la entrega. Lleva la
 * `version` del estado de la parada: la confirmación solo procede si el resumen
 * que se firmó sigue siendo el vigente.
 */
export class DriverDeliverySummaryDto {
  @ApiProperty({ example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: 1002 })
  route_sheet_detail_id: number;

  @ApiProperty({ enum: DriverStopType })
  stop_type: DriverStopType;

  @ApiProperty({ example: 'PENDING' })
  delivery_status: string;

  @ApiProperty({
    description: 'Es la parada habilitada para operar',
    example: true,
  })
  is_current: boolean;

  @ApiProperty({ description: 'Está resuelta (entregada, fallida, etc.)' })
  is_resolved: boolean;

  @ApiProperty({
    description:
      'Hash del estado mutable de la parada. Debe viajar de vuelta al confirmar',
    example: '3f9a1c7d5b2e4a60',
  })
  version: string;

  @ApiProperty({ type: DriverDeliveryDetailCustomerDto })
  customer: DriverDeliveryDetailCustomerDto;

  @ApiProperty({ type: [DriverDeliverySummaryItemDto] })
  items: DriverDeliverySummaryItemDto[];

  @ApiProperty({
    type: [DriverDeliveryPaymentDto],
    description: 'Cobros ya registrados sobre la obligación de la parada',
  })
  payments: DriverDeliveryPaymentDto[];

  @ApiProperty({ type: DriverDeliverySummaryTotalsDto })
  totals: DriverDeliverySummaryTotalsDto;

  @ApiProperty({
    description:
      'La entrega exige firma del receptor o, en su defecto, un motivo autorizado',
    example: true,
  })
  requires_signature: boolean;

  @ApiProperty({ description: 'Ya hay una firma registrada para esta parada' })
  signature_present: boolean;

  @ApiPropertyOptional({
    description: 'Motivo autorizado registrado al confirmar sin firma',
    nullable: true,
    enum: DriverSignatureMissingReason,
  })
  signature_missing_reason: string | null;
}

/** Firma manuscrita del receptor, enviada como data URI base64. */
export class RegisterDeliverySignatureDto {
  @ApiProperty({
    description: 'Firma en base64 con su data URI (data:image/png;base64,...)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
  })
  @IsString()
  @MinLength(30)
  @MaxLength(3_000_000)
  signature: string;

  @ApiPropertyOptional({
    description: 'Nombre de quien recibe y firma',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  received_by_name?: string;

  @ApiPropertyOptional({
    description:
      'Versión del resumen que el chofer tenía a la vista, para detectar datos obsoletos',
    example: 'a1b2c3d4e5f60718',
  })
  @IsOptional()
  @IsString()
  version?: string;
}

export class DriverDeliverySignatureResultDto {
  @ApiProperty({ example: 41 })
  evidence_id: number;

  @ApiProperty({ example: 1002 })
  route_sheet_detail_id: number;

  @ApiProperty({
    description: 'URL pública de la firma guardada',
    example:
      'http://localhost:3000/public/uploads/delivery-evidence/signature_1002_1.png',
  })
  file_url: string;

  @ApiPropertyOptional({ nullable: true })
  received_by_name: string | null;

  @ApiProperty({ example: '2026-10-12T09:10:00-03:00' })
  created_at: string;

  @ApiProperty({ example: '3f9a1c7d5b2e4a60' })
  version: string;
}

/** Confirmación de la entrega. Sin firma registrada se exige un motivo. */
export class ConfirmDeliveryDto {
  @ApiPropertyOptional({
    description:
      'Versión del resumen firmado. Si no coincide con el estado actual se rechaza',
    example: '3f9a1c7d5b2e4a60',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description:
      'Motivo autorizado cuando el receptor no puede firmar. Queda auditado',
    enum: DriverSignatureMissingReason,
  })
  @IsOptional()
  @IsIn(DRIVER_SIGNATURE_MISSING_REASONS)
  signature_missing_reason?: DriverSignatureMissingReason;
}

/** Cantidad de un producto efectivamente descontada del camión al entregar. */
export class DriverDeliveredItemDto {
  @ApiProperty({ example: 4 })
  product_id: number;

  @ApiProperty({ example: 2 })
  quantity: number;
}

export class DriverDeliveryConfirmationResultDto {
  @ApiProperty({ example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: 1002 })
  route_sheet_detail_id: number;

  @ApiProperty({ example: 'DELIVERED' })
  delivery_status: string;

  @ApiPropertyOptional({
    description: 'Estado del pedido asociado, si la parada es un pedido',
    nullable: true,
    example: 'DELIVERED',
  })
  order_status: string | null;

  @ApiProperty({ description: 'La entrega quedó firmada por el receptor' })
  signature_present: boolean;

  @ApiPropertyOptional({ nullable: true })
  signature_missing_reason: string | null;

  @ApiProperty({
    type: [DriverDeliveredItemDto],
    description: 'Productos y cantidades descontadas del stock del camión',
  })
  delivered_items: DriverDeliveredItemDto[];

  @ApiProperty({
    description:
      'true si la entrega ya estaba confirmada y se devolvió sin volver a aplicar efectos',
    example: false,
  })
  idempotent_replay: boolean;

  @ApiProperty({ type: DriverDeliveryDetailDto })
  delivery: DriverDeliveryDetailDto;
}
