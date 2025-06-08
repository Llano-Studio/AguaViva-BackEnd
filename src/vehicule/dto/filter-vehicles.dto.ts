import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterVehiclesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por nombre, código o descripción',
    example: 'truck',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por código de vehículo',
    example: 'TRUCK-001',
  })
  @IsOptional()
  @IsString()
  code?: string;
} 