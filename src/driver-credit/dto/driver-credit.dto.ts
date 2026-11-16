import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export enum DriverCreditChargeStatus {
  OPEN = 'OPEN',
  SETTLED = 'SETTLED',
}

/** Filtro de estado para listar cargos. `OVERDUE` son los abiertos y vencidos. */
export const DRIVER_CREDIT_STATUS_FILTERS = ['OPEN', 'OVERDUE', 'SETTLED'];

export class DriverCreditChargeDto {
  @ApiProperty({ example: 12 })
  charge_id: number;

  @ApiProperty({ example: 7 })
  driver_id: number;

  @ApiPropertyOptional({ nullable: true, example: 'Juan Chofer' })
  driver_name: string | null;

  @ApiProperty({ example: 5885 })
  customer_id: number;

  @ApiPropertyOptional({ nullable: true, example: 'Almacén Don Pepe' })
  customer_name: string | null;

  @ApiProperty({ example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: 1002 })
  route_sheet_detail_id: number;

  @ApiProperty({ example: 7001 })
  payment_transaction_id: number;

  @ApiProperty({
    description: 'Fecha del cargo (Buenos Aires)',
    example: '2026-11-16',
  })
  charge_date: string;

  @ApiProperty({ description: 'Vencimiento', example: '2026-12-10' })
  due_date: string;

  @ApiProperty({ example: '100000.00' })
  amount: string;

  @ApiProperty({ example: '20000.00' })
  settled_amount: string;

  @ApiProperty({ description: 'Tasa de interés por mora', example: '0.2000' })
  interest_rate: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Monto sobre el que se calculó el interés',
    example: '80000.00',
  })
  interest_base: string | null;

  @ApiPropertyOptional({ nullable: true, example: '16000.00' })
  interest_amount: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-12-11T00:05:00-03:00' })
  interest_applied_at: string | null;

  @ApiProperty({
    description: 'Capital más interés menos pagado',
    example: '96000.00',
  })
  outstanding: string;

  @ApiProperty({ enum: DriverCreditChargeStatus })
  status: DriverCreditChargeStatus;

  @ApiProperty({ description: 'Abierto y con el vencimiento pasado' })
  overdue: boolean;
}

export class DriverCreditSummaryDto {
  @ApiProperty({ description: 'Saldo pendiente total', example: '96000.00' })
  outstanding: string;

  @ApiProperty({
    description: 'Saldo pendiente de cargos vencidos',
    example: '96000.00',
  })
  overdue: string;

  @ApiProperty({ description: 'Intereses aplicados', example: '16000.00' })
  interest_applied: string;

  @ApiProperty({ example: 3 })
  open_charges: number;
}

export class DriverCreditListDto {
  @ApiProperty({ type: DriverCreditSummaryDto })
  summary: DriverCreditSummaryDto;

  @ApiProperty({ type: [DriverCreditChargeDto] })
  data: DriverCreditChargeDto[];

  @ApiProperty({ example: { page: 1, limit: 50, total: 3, total_pages: 1 } })
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export class FilterDriverCreditsDto {
  @ApiPropertyOptional({ description: 'Chofer (solo administración)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  driver_id?: number;

  @ApiPropertyOptional({ description: 'Cliente' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customer_id?: number;

  @ApiPropertyOptional({ enum: DRIVER_CREDIT_STATUS_FILTERS })
  @IsOptional()
  @IsIn(DRIVER_CREDIT_STATUS_FILTERS)
  status?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/** Pago del chofer a cuenta de su deuda con clientes. */
export class RegisterDriverCreditPaymentDto {
  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description:
      'Cargos a los que se imputa, en ese orden de prioridad. Si se omite, se imputa del más viejo al más nuevo',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Transform(({ value }: { value: unknown }): unknown =>
    Array.isArray(value) ? value.map((v) => Number(v)) : value,
  )
  charge_ids?: number[];

  @ApiPropertyOptional({ example: 'Pagó en efectivo en la oficina' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @ApiProperty({ example: '7f6d3c1e-pago-chofer-1' })
  @IsString()
  @MaxLength(60)
  idempotency_key: string;
}

export class DriverCreditPaymentResultDto {
  @ApiProperty({ example: 88 })
  movement_id: number;

  @ApiProperty({ example: '50000.00' })
  amount: string;

  @ApiProperty({ example: [{ charge_id: 12, amount: '50000.00' }] })
  allocations: { charge_id: number; amount: string }[];

  @ApiProperty({ description: 'true si la clave ya se había usado' })
  idempotent_replay: boolean;

  @ApiProperty({ type: DriverCreditSummaryDto })
  summary: DriverCreditSummaryDto;
}

export class ApplyDriverCreditInterestResultDto {
  @ApiProperty({ example: '2026-12-11' })
  date: string;

  @ApiProperty({
    description: 'Cargos a los que se les aplicó interés',
    example: 2,
  })
  applied: number;

  @ApiProperty({ example: '18000.00' })
  total_interest: string;
}
