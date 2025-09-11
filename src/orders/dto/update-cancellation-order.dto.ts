import {
  IsOptional,
  IsDateString,
  IsEnum,
  IsInt,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CancellationOrderStatus } from '@prisma/client';

export class UpdateCancellationOrderDto {
  @ApiPropertyOptional({
    description: 'Fecha programada para recolección',
    example: '2025-09-12',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return new Date(value);
    }
    return value;
  })
  scheduled_collection_date?: Date;

  @ApiPropertyOptional({
    description: 'Fecha real de recolección',
    example: '2025-09-12',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return new Date(value);
    }
    return value;
  })
  actual_collection_date?: Date;

  @ApiPropertyOptional({
    description: 'Estado de la orden de cancelación',
    enum: CancellationOrderStatus,
  })
  @IsOptional()
  @IsEnum(CancellationOrderStatus)
  status?: CancellationOrderStatus;

  @ApiPropertyOptional({
    description: 'ID de la hoja de ruta',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  route_sheet_id?: number;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Notas actualizadas',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}