import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterProductsDto extends PaginationQueryDto {
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
} 