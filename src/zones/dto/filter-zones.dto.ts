import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
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
    description: 'Filtrar por ID de localidad (para compatibilidad)',
    example: 1,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  locality_id?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por IDs de localidades múltiples. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Si no hay valor, retornar undefined
    if (!value) return undefined;

    if (typeof value === 'string') {
      // Si viene como string separado por comas, convertir a array
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      // Si ya es array, asegurar que sean números
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  locality_ids?: number[];

  @ApiPropertyOptional({
    description: 'Filtrar por nombre de localidad (búsqueda parcial)',
    example: 'Buenos Aires',
  })
  @IsOptional()
  @IsString()
  locality_name?: string;
}
