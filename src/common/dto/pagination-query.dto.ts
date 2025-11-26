import {
  IsOptional,
  IsInt,
  Min,
  IsString,
  Max,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BUSINESS_CONFIG } from '../config/business.config';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE,
    default: BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE,
    type: Number,
  })
  @IsOptional()
  @ValidateIf(
    (o, value) => value !== undefined && value !== null && value !== '',
  )
  @Transform(({ value }) => (value === '' ? undefined : parseInt(value)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  page?: number;

  @ApiPropertyOptional({
    description: 'Límite de resultados por página',
    example: BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
    default: BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
    type: Number,
  })
  @IsOptional()
  @ValidateIf(
    (o, value) => value !== undefined && value !== null && value !== '',
  )
  @Transform(({ value }) => (value === '' ? undefined : parseInt(value)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BUSINESS_CONFIG.PAGINATION.MAX_LIMIT)
  limit?: number;

  @ApiPropertyOptional({
    description:
      "Campos para ordenar. Formato: campo1,-campo2 (prefijo '-' para descendente)",
    example: '-createdAt,name',
  })
  @IsOptional()
  @ValidateIf(
    (o, value) => value !== undefined && value !== null && value !== '',
  )
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  sortBy?: string;
}
