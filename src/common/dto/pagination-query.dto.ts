import { IsOptional, IsInt, Min, IsString, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BUSINESS_CONFIG } from '../config/business.config';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    example: BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE,
    default: BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE,
    type: Number
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = BUSINESS_CONFIG.PAGINATION.DEFAULT_PAGE;

  @ApiPropertyOptional({
    description: 'Límite de resultados por página',
    example: BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
    default: BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
    type: Number
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(BUSINESS_CONFIG.PAGINATION.MAX_LIMIT)
  limit?: number = BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Campos para ordenar. Formato: campo1,-campo2 (prefijo \'-\' para descendente)',
    example: '-createdAt,name'
  })
  @IsOptional()
  @IsString()
  sortBy?: string;
} 