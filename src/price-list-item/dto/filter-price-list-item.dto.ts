import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterPriceListItemDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de la lista de precios',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  price_list_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del producto',
    example: 101,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  product_id?: number;
} 