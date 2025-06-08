import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterSubscriptionPlansDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por nombre o descripción del plan',
    example: 'premium',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre específico del plan de suscripción',
    example: 'Plan Premium',
  })
  @IsOptional()
  @IsString()
  name?: string;

  // sortBy, page, limit se heredan de PaginationQueryDto
  // Si se eliminan todas las propiedades propias de FilterSubscriptionPlansDto, se puede simplificar a:
  // export class FilterSubscriptionPlansDto extends PaginationQueryDto {}
  // Pero mantendré 'name' como ejemplo de filtro específico del DTO.
} 