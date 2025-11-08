import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsInt, IsArray, ArrayNotEmpty, ArrayUnique } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateDailyRouteSheetsDto {
  @ApiPropertyOptional({ description: 'Fecha objetivo (YYYY-MM-DD)', example: '2025-11-06' })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe estar en formato YYYY-MM-DD válido' })
  date?: string;

  @ApiPropertyOptional({ description: 'ID del vehículo a procesar (opcional)', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  vehicleId?: number;

  @ApiPropertyOptional({ description: 'IDs de zonas a incluir (opcional)', type: [Number], example: [3, 7, 9] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  zoneIds?: number[];

  @ApiPropertyOptional({ description: 'ID del conductor (opcional)', example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  driverId?: number;

  @ApiPropertyOptional({ description: 'Solo cobranzas vencidas', example: 'false', enum: ['true', 'false'] })
  @IsOptional()
  overdueOnly?: 'true' | 'false';

  @ApiPropertyOptional({ description: 'Ordenamiento', example: 'zone', enum: ['zone', 'amount', 'priority', 'customer'] })
  @IsOptional()
  sortBy?: 'zone' | 'amount' | 'priority' | 'customer';

  @ApiPropertyOptional({ description: 'Formato del PDF', example: 'compact', enum: ['compact', 'standard', 'detailed'] })
  @IsOptional()
  format?: 'compact' | 'standard' | 'detailed';

  @ApiPropertyOptional({ description: 'Notas para la hoja de ruta', example: 'Generación manual diaria' })
  @IsOptional()
  notes?: string;
}