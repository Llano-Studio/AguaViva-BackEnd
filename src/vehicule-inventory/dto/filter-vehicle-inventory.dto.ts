import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto'; // Ruta corregida

export class FilterVehiculeInventoryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID del vehículo',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  vehicle_id?: number;

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
