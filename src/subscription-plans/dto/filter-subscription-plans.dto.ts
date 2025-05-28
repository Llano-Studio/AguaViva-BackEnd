import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterSubscriptionPlansDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por nombre del plan de suscripción (búsqueda parcial)',
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