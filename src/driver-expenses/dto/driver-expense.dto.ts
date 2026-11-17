import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Rubros de gasto del chofer. `OTRO` exige descripción. */
export enum DriverExpenseCategory {
  COMBUSTIBLE = 'COMBUSTIBLE',
  GOMERIA = 'GOMERIA',
  MECANICA = 'MECANICA',
  PEAJE = 'PEAJE',
  OTRO = 'OTRO',
}

export const DRIVER_EXPENSE_CATEGORIES = Object.values(DriverExpenseCategory);

export class CreateDriverExpenseDto {
  @ApiProperty({ enum: DriverExpenseCategory })
  @IsIn(DRIVER_EXPENSE_CATEGORIES)
  category: DriverExpenseCategory;

  @ApiProperty({ example: 15000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ example: 'Carga de nafta en YPF Ruta 11' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Nro. de ticket o factura',
    example: '0001-00012345',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  receipt_reference?: string;

  @ApiProperty({ example: 'gasto-345-1' })
  @IsString()
  @MaxLength(80)
  idempotency_key: string;
}

export class VoidDriverExpenseDto {
  @ApiPropertyOptional({ example: 'Lo cargué dos veces' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class DriverExpenseDto {
  @ApiProperty({ example: 31 })
  expense_id: number;

  @ApiProperty({ example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: 7 })
  driver_id: number;

  @ApiPropertyOptional({ nullable: true, example: 'Juan Chofer' })
  driver_name: string | null;

  @ApiProperty({ enum: DriverExpenseCategory })
  category: DriverExpenseCategory;

  @ApiProperty({ example: '15000.00' })
  amount: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  receipt_reference: string | null;

  @ApiProperty({ example: '2026-11-16T12:30:00-03:00' })
  created_at: string;

  @ApiProperty()
  is_active: boolean;

  @ApiPropertyOptional({ nullable: true })
  void_reason: string | null;
}

export class DriverExpenseListDto {
  @ApiProperty({
    description: 'Total de gastos activos del listado',
    example: '15000.00',
  })
  total_amount: string;

  @ApiProperty({ type: [DriverExpenseDto] })
  data: DriverExpenseDto[];

  @ApiProperty({ example: { page: 1, limit: 50, total: 1, total_pages: 1 } })
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export class FilterDriverExpensesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  driver_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  route_sheet_id?: number;

  @ApiPropertyOptional({ enum: DriverExpenseCategory })
  @IsOptional()
  @IsIn(DRIVER_EXPENSE_CATEGORIES)
  category?: DriverExpenseCategory;

  @ApiPropertyOptional({ description: 'Desde (YYYY-MM-DD, fecha de carga)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Hasta (YYYY-MM-DD, inclusive)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

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
