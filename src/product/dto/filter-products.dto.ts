import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterProductsDto {
  @ApiPropertyOptional({
    description: 'ID de categoría para filtrar productos',
    example: 1
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
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
  @Type(() => Boolean)
  isReturnable?: boolean;

  @ApiPropertyOptional({
    description: 'Número de serie del producto',
    example: 'SN123456'
  })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({
    description: 'Número de página para paginación',
    example: 1,
    default: 1
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por página',
    example: 10,
    default: 10
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
} 