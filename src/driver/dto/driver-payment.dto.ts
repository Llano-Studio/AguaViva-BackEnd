import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { DriverDeliveryDetailDto } from './driver-delivery-detail.dto';

/** Tipo de comprobante que el chofer adjunta a una parada. */
export enum DriverPaymentProofKind {
  CASH_RECEIPT = 'CASH_RECEIPT',
  TRANSFER_RECEIPT = 'TRANSFER_RECEIPT',
  QR_RECEIPT = 'QR_RECEIPT',
  OTHER = 'OTHER',
}

export const DRIVER_PAYMENT_PROOF_KINDS: DriverPaymentProofKind[] = [
  DriverPaymentProofKind.CASH_RECEIPT,
  DriverPaymentProofKind.TRANSFER_RECEIPT,
  DriverPaymentProofKind.QR_RECEIPT,
  DriverPaymentProofKind.OTHER,
];

/** Método de pago habilitado para el cobro en ruta. */
export class DriverPaymentOptionDto {
  @ApiProperty({ example: 1 })
  payment_method_id: number;

  @ApiProperty({ example: 'EFECTIVO' })
  code: string;

  @ApiProperty({ example: 'Pago en efectivo' })
  description: string;

  @ApiProperty({
    description:
      'Exige una referencia del comprobante (nro. de transferencia, etc.)',
    example: false,
  })
  requires_reference: boolean;

  @ApiProperty({
    description: 'Exige informar el efectivo recibido para calcular el vuelto',
    example: true,
  })
  requires_amount_received: boolean;
}

/** Datos de transferencia de la empresa (pueden no estar configurados). */
export class DriverTransferDataDto {
  @ApiPropertyOptional({ nullable: true })
  cbu: string | null;

  @ApiPropertyOptional({ nullable: true })
  alias: string | null;

  @ApiPropertyOptional({ nullable: true })
  holder: string | null;

  @ApiPropertyOptional({ nullable: true })
  bank: string | null;
}

export class DriverPaymentOptionsDto {
  @ApiProperty({ type: [DriverPaymentOptionDto] })
  methods: DriverPaymentOptionDto[];

  @ApiPropertyOptional({ type: DriverTransferDataDto, nullable: true })
  transfer: DriverTransferDataDto | null;

  constructor(partial: Partial<DriverPaymentOptionsDto>) {
    Object.assign(this, partial);
  }
}

/**
 * Cobro de una parada. `amount` es el monto imputado a la obligación (pedido,
 * compra puntual o ciclo). Para efectivo se informa `amount_received` y el
 * vuelto se calcula en el servidor: recibido menos vuelto debe coincidir con el
 * efectivo retenido.
 */
export class RegisterDeliveryPaymentDto {
  @ApiProperty({ description: 'ID del método de pago', example: 1 })
  @IsInt()
  @Min(1)
  payment_method_id: number;

  @ApiProperty({
    description: 'Monto imputado a la obligación',
    example: 1500.5,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description:
      'Efectivo recibido. Obligatorio para efectivo y debe ser >= amount',
    example: 2000,
    type: Number,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  amount_received?: number;

  @ApiPropertyOptional({
    description: 'Referencia del comprobante (nro. de transferencia, etc.)',
    example: 'TRF-123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transaction_reference?: string;

  @ApiPropertyOptional({ description: 'Notas del cobro' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({
    description:
      'Clave de idempotencia del cobro. Reintentar con la misma clave devuelve el cobro ya registrado; con otro payload se rechaza.',
    example: '8f1c2f7a-1b2c-4d5e-9f10-2a3b4c5d6e7f',
  })
  @IsString()
  @MaxLength(80)
  idempotency_key: string;

  @ApiPropertyOptional({
    description:
      'Versión del detalle que el chofer tenía a la vista, para detectar datos obsoletos',
    example: 'a1b2c3d4e5f60718',
  })
  @IsOptional()
  @IsString()
  version?: string;
}

export class DriverPaymentResultDto {
  @ApiProperty({ example: 7001 })
  transaction_id: number;

  @ApiProperty({ example: '2026-10-12T09:05:00-03:00' })
  transaction_date: string;

  @ApiProperty({ example: '1500.00' })
  amount_applied: string;

  @ApiProperty({ example: '2000.00' })
  amount_received: string;

  @ApiProperty({ example: '500.00' })
  change_amount: string;

  @ApiProperty({ example: 'EFECTIVO' })
  payment_method: string;

  @ApiProperty({ example: 'RS-345-D1002' })
  document_number: string;

  @ApiPropertyOptional({ nullable: true })
  receipt_number: string | null;

  @ApiProperty({
    description:
      'true si el cobro ya estaba registrado y se devolvió sin volver a aplicar el pago',
    example: false,
  })
  idempotent_replay: boolean;

  @ApiProperty({ type: DriverDeliveryDetailDto })
  delivery: DriverDeliveryDetailDto;
}

export class DriverPaymentProofDto {
  @ApiProperty({ example: 12 })
  proof_id: number;

  @ApiProperty({ enum: DriverPaymentProofKind })
  kind: DriverPaymentProofKind;

  @ApiProperty({ example: 'transferencia-ab12.png' })
  file_name: string;

  @ApiProperty({ example: 'image/png' })
  mime_type: string;

  @ApiProperty({ example: 184320 })
  size_bytes: number;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'URL pública del comprobante',
  })
  url: string | null;

  @ApiPropertyOptional({ nullable: true })
  uploaded_by: number | null;

  @ApiProperty({ example: '2026-10-12T09:06:00-03:00' })
  created_at: string;
}

/** Campos de texto que acompañan al archivo multipart del comprobante. */
export class RegisterPaymentProofBodyDto {
  @ApiProperty({ enum: DriverPaymentProofKind })
  @IsIn(DRIVER_PAYMENT_PROOF_KINDS)
  kind: DriverPaymentProofKind;

  @ApiPropertyOptional({ description: 'Notas del comprobante' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Cobro al que se asocia el comprobante, si ya se registró',
    example: 7001,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  payment_transaction_id?: number;
}
