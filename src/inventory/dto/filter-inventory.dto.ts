import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterInventoryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'ID del almacén para filtrar el inventario (para compatibilidad)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  warehouse_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples IDs de almacenes. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      const ids = value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map(id => parseInt(id)).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  warehouse_ids?: number[];

  @ApiPropertyOptional({
    description: 'ID del producto para filtrar el inventario (para compatibilidad)',
    example: 101,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  product_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples IDs de productos. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [101, 102, 103],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      const ids = value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map(id => parseInt(id)).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  product_ids?: number[];

  @ApiPropertyOptional({
    description: 'Texto para buscar en la descripción del producto (búsqueda parcial insensible a mayúsculas)',
    example: 'Agua Bidón',
  })
  @IsOptional()
  @IsString()
  product_description?: string;

  @ApiPropertyOptional({
    description: 'ID de la categoría del producto para filtrar (para compatibilidad)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  category_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples IDs de categorías. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      const ids = value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map(id => parseInt(id)).filter(id => !isNaN(id));
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
  @ApiProperty()
  warehouse_id: number;
  @ApiProperty()
  product_id: number;
  @ApiProperty()
  quantity: number;
  @ApiProperty()
  product_description: string;
  @ApiProperty()
  product_category: string;
  @ApiProperty()
  warehouse_name: string;
  @ApiProperty()
  warehouse_locality: string;
}

export class PaginatedInventoryResponseDto {
  @ApiProperty({ type: [InventoryDetailDto] })
  data: InventoryDetailDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}