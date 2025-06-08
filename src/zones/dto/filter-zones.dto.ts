import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterZonesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por nombre o código de zona',
    example: 'norte',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by zone name',
    example: 'Zona Norte',
  })
  @IsOptional()
  @IsString()
  name?: string;
} 