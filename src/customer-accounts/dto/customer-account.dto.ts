import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountMovementSide } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AccountMovementConcept } from '../account-statement';

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YMD_MESSAGE = 'debe tener formato YYYY-MM-DD';

export class CustomerAccountQueryDto {
  @ApiPropertyOptional({
    description: 'Desde (YYYY-MM-DD)',
    example: '2026-11-01',
  })
  @IsOptional()
  @Matches(YMD, { message: `from ${YMD_MESSAGE}` })
  from?: string;

  @ApiPropertyOptional({
    description: 'Hasta (YYYY-MM-DD)',
    example: '2026-11-30',
  })
  @IsOptional()
  @Matches(YMD, { message: `to ${YMD_MESSAGE}` })
  to?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class CustomerAccountCustomerDto {
  @ApiProperty({ example: 5885 })
  person_id: number;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiProperty({ example: '3624123456' })
  phone: string;
}

export class CustomerAccountSummaryDto {
  @ApiProperty({
    description:
      'Saldo actual: positivo = el cliente debe; negativo = saldo a favor',
    example: '15400.00',
  })
  balance: string;

  @ApiProperty({
    description: 'Deuda actual (0 si tiene saldo a favor)',
    example: '15400.00',
  })
  debt: string;

  @ApiProperty({
    description: 'Saldo a favor actual (0 si debe)',
    example: '0.00',
  })
  credit: string;

  @ApiProperty({ example: '48200.00' })
  total_debits: string;

  @ApiProperty({ example: '32800.00' })
  total_credits: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-11-12' })
  last_payment_date: string | null;
}

export class CustomerAccountMovementDto {
  @ApiProperty({ description: 'Identificador estable', example: 'ORDER-123' })
  key: string;

  @ApiProperty({ example: '2026-11-12' })
  date: string;

  @ApiProperty({ enum: AccountMovementSide })
  side: AccountMovementSide;

  @ApiProperty({ enum: AccountMovementConcept })
  concept: AccountMovementConcept;

  @ApiPropertyOptional({ nullable: true })
  reference_id: number | null;

  @ApiProperty({ example: 'Pedido #123' })
  description: string;

  @ApiProperty({ example: '2400.00' })
  amount: string;

  @ApiPropertyOptional({ nullable: true, example: '2400.00' })
  debit: string | null;

  @ApiPropertyOptional({ nullable: true })
  credit: string | null;

  @ApiProperty({
    description: 'Saldo acumulado después del movimiento',
    example: '2400.00',
  })
  balance: string;

  @ApiPropertyOptional({ nullable: true, example: 'Efectivo' })
  payment_method: string | null;
}

export class CustomerAccountPeriodDto {
  @ApiPropertyOptional({ nullable: true })
  from: string | null;

  @ApiPropertyOptional({ nullable: true })
  to: string | null;

  @ApiProperty({ description: 'Saldo al inicio del período' })
  opening_balance: string;

  @ApiProperty({ description: 'Saldo al final del período' })
  closing_balance: string;
}

export class CustomerAccountMovementsPageDto {
  @ApiProperty({ type: [CustomerAccountMovementDto] })
  data: CustomerAccountMovementDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class CustomerAccountResponseDto {
  @ApiProperty({ type: CustomerAccountCustomerDto })
  customer: CustomerAccountCustomerDto;

  @ApiProperty({ type: CustomerAccountSummaryDto })
  summary: CustomerAccountSummaryDto;

  @ApiProperty({ type: CustomerAccountPeriodDto })
  period: CustomerAccountPeriodDto;

  @ApiProperty({ type: CustomerAccountMovementsPageDto })
  movements: CustomerAccountMovementsPageDto;
}

export class CreateAccountAdjustmentDto {
  @ApiProperty({
    enum: AccountMovementSide,
    description: 'DEBIT suma deuda; CREDIT la descuenta (saldo a favor)',
  })
  @IsEnum(AccountMovementSide)
  side: AccountMovementSide;

  @ApiProperty({ example: 1500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({
    description: 'Fecha contable (YYYY-MM-DD). Por defecto, hoy.',
  })
  @IsOptional()
  @Matches(YMD, { message: `movement_date ${YMD_MESSAGE}` })
  movement_date?: string;

  @ApiProperty({ example: 'Bonificación por bidón dañado' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;
}

export class VoidAccountAdjustmentDto {
  @ApiProperty({ example: 'Cargado por error' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}

export class AccountAdjustmentResponseDto {
  @ApiProperty()
  adjustment_id: number;

  @ApiProperty()
  customer_id: number;

  @ApiProperty({ example: 'MANUAL' })
  kind: string;

  @ApiProperty({ enum: AccountMovementSide })
  side: AccountMovementSide;

  @ApiProperty({ example: '1500.00' })
  amount: string;

  @ApiProperty({ example: '2026-11-16' })
  movement_date: string;

  @ApiProperty()
  description: string;

  @ApiPropertyOptional({ nullable: true })
  source_reference: string | null;

  @ApiProperty()
  is_active: boolean;

  @ApiPropertyOptional({ nullable: true })
  void_reason: string | null;
}

export class OpeningBalanceRowDto {
  @ApiPropertyOptional({
    description: 'Fila del Excel, para el reporte de errores',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  row?: number;

  @ApiPropertyOptional({
    description: 'ID del cliente (person_id). Usar este o phone.',
  })
  @IsOptional()
  @IsInt()
  customer_id?: number;

  @ApiPropertyOptional({
    description:
      'Teléfono del cliente; se comparan solo los dígitos. Usar este o customer_id.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiProperty({
    description: 'Saldo: positivo = el cliente debe; negativo = saldo a favor',
    example: 12500,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class ImportOpeningBalancesDto {
  @ApiProperty({
    description: 'Identifica la carga (ej. nombre del Excel)',
    example: 'deuda-anterior-2026-11.xlsx',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  source_reference: string;

  @ApiProperty({
    description: 'Fecha contable del saldo inicial (YYYY-MM-DD)',
    example: '2026-11-15',
  })
  @Matches(YMD, { message: `movement_date ${YMD_MESSAGE}` })
  movement_date: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Con true solo valida y devuelve el reporte, sin guardar nada',
  })
  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;

  @ApiProperty({ type: [OpeningBalanceRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => OpeningBalanceRowDto)
  rows: OpeningBalanceRowDto[];
}

export class OpeningBalanceImportErrorDto {
  @ApiProperty({
    description: 'Fila del Excel o posición en el arreglo (desde 1)',
  })
  row: number;

  @ApiProperty()
  message: string;
}

export class OpeningBalanceImportResultDto {
  @ApiProperty()
  dry_run: boolean;

  @ApiProperty()
  total_rows: number;

  @ApiProperty({ description: 'Filas válidas (con monto distinto de 0)' })
  valid_rows: number;

  @ApiProperty({ description: 'Filas con monto 0, que no generan movimiento' })
  skipped_zero_rows: number;

  @ApiProperty({ example: '1250000.00' })
  total_debit: string;

  @ApiProperty({ example: '35000.00' })
  total_credit: string;

  @ApiProperty({
    description: 'Saldos iniciales creados (0 en dry_run o si hubo errores)',
  })
  created: number;

  @ApiProperty({ type: [OpeningBalanceImportErrorDto] })
  errors: OpeningBalanceImportErrorDto[];
}
