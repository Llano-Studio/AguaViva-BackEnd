import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterRouteSheetsDto {
  @ApiPropertyOptional({
    description: 'ID del conductor',
    example: 1
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  driver_id?: number;

  @ApiPropertyOptional({
    description: 'ID del vehículo',
    example: 1
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  vehicle_id?: number;

  @ApiPropertyOptional({
    description: 'Fecha desde (YYYY-MM-DD)',
    example: '2023-07-01'
  })
  @IsDateString()
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (YYYY-MM-DD)',
    example: '2023-07-31'
  })
  @IsDateString()
  @IsOptional()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Página (para paginación)',
    example: 1,
    default: 1
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Límite por página',
    example: 10,
    default: 10
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
} 