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
    description: 'ID de categoría para filtrar productos (para compatibilidad)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInteger(value))
  categoryId?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por IDs de categorías múltiples. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Si no hay valor, retornar undefined
    if (!value) return undefined;

    if (typeof value === 'string') {
      // Si viene como string separado por comas, convertir a array
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      // Si ya es array, asegurar que sean números
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  categoryIds?: number[];

  @ApiPropertyOptional({
    description: 'Filtrar por descripción del producto (búsqueda parcial)',
    example: 'Botella',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por productos retornables',
    example: true,
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
    example: 'SN123456',
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Incluir información detallada del inventario por almacén',
    example: true,
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
