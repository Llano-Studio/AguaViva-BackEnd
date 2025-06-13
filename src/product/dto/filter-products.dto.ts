import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { parseInteger } from '../../common/utils/parse-number';

export class FilterProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por descripción, número de serie o notas',
    example: 'botella',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'ID de categoría para filtrar productos',
    example: 1
  })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInteger(value))
  categoryId?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por descripción del producto (búsqueda parcial)',
    example: 'Botella'
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por productos retornables',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  isReturnable?: boolean;

  @ApiPropertyOptional({
    description: 'Número de serie del producto',
    example: 'SN123456'
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Incluir información detallada del inventario por almacén',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  includeInventory?: boolean;
} 