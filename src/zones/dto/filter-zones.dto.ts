import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
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
    description: 'Filtrar por nombre específico de zona',
    example: 'Zona Norte',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de localidad',
    example: 1,
    type: 'integer'
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  locality_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre de localidad (búsqueda parcial)',
    example: 'Buenos Aires',
  })
  @IsOptional()
  @IsString()
  locality_name?: string;
} 