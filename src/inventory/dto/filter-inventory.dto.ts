import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterInventoryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'ID del almacén para filtrar el inventario (para compatibilidad)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouse_id?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples IDs de almacenes. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;

    if (typeof value === 'string') {
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  warehouse_ids?: number[];

  @ApiPropertyOptional({
    description:
      'ID del producto para filtrar el inventario (para compatibilidad)',
    example: 101,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  product_id?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples IDs de productos. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [101, 102, 103],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;

    if (typeof value === 'string') {
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  product_ids?: number[];

  @ApiPropertyOptional({
    description:
      'Texto para buscar en la descripción del producto (búsqueda parcial insensible a mayúsculas)',
    example: 'Agua Bidón',
  })
  @IsOptional()
  @IsString()
  product_description?: string;

  @ApiPropertyOptional({
    description:
      'ID de la categoría del producto para filtrar (para compatibilidad)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  category_id?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples IDs de categorías. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;

    if (typeof value === 'string') {
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  category_ids?: number[];

  @ApiPropertyOptional({
    description: 'Cantidad mínima de stock para filtrar',
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_quantity?: number;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de stock para filtrar',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_quantity?: number;
}

export class InventoryDetailDto {
  @ApiProperty({
    description: 'ID único del almacén donde se encuentra el producto',
    example: 1,
  })
  warehouse_id: number;

  @ApiProperty({
    description: 'ID único del producto en inventario',
    example: 15,
  })
  product_id: number;

  @ApiProperty({
    description: 'Cantidad actual disponible en stock',
    example: 150,
    minimum: 0,
  })
  quantity: number;

  @ApiProperty({
    description: 'Descripción completa del producto',
    example: 'Agua Mineral Natural 500ml',
  })
  product_description: string;

  @ApiProperty({
    description: 'Categoría a la que pertenece el producto',
    example: 'Bebidas',
  })
  product_category: string;

  @ApiProperty({
    description: 'Nombre del almacén donde se almacena',
    example: 'Almacén Principal',
  })
  warehouse_name: string;

  @ApiProperty({
    description: 'Localidad donde se ubica el almacén',
    example: 'Rosario Centro',
  })
  warehouse_locality: string;
}

export class PaginatedInventoryResponseDto {
  @ApiProperty({
    type: [InventoryDetailDto],
    description: 'Lista de registros de inventario con información detallada',
  })
  data: InventoryDetailDto[];

  @ApiProperty({
    example: 100,
    description: 'Número total de registros de inventario disponibles',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Página actual de los resultados',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Número de registros por página',
  })
  limit: number;

  @ApiProperty({
    example: 10,
    description: 'Número total de páginas disponibles',
  })
  totalPages: number;
}
