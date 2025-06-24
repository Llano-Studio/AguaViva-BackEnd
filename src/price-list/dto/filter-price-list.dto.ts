import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterPriceListDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por nombre o descripción de lista de precios',
    example: 'estándar',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre específico de la lista',
    example: 'Lista Estándar',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo. true = solo activas, false = solo inactivas',
    example: true,
    type: 'boolean'
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por lista por defecto. true = solo la lista por defecto, false = solo listas no por defecto',
    example: false,
    type: 'boolean'
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_default?: boolean;
} 