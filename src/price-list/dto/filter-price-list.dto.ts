import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterPriceListDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por nombre de lista de precios',
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
} 