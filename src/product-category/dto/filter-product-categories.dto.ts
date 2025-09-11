import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterProductCategoriesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por nombre de categoría',
    example: 'bidones',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre específico de la categoría',
    example: 'Bidones',
  })
  @IsOptional()
  @IsString()
  name?: string;

  // page, limit, y sortBy se heredan de PaginationQueryDto
  // Podrías añadir más filtros específicos para categorías si es necesario
  // Por ejemplo, filtrar por si está activa, aunque el modelo actual no tiene 'active'
  /*
  @ApiPropertyOptional({
    description: 'Filtrar por estado activo de la categoría.',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;
  */
}
