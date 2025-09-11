import {
  IsString,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePriceListDto {
  @ApiProperty({
    description: 'Nombre de la lista de precios',
    example: 'Lista Estándar Q1 2024',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Descripción detallada de la lista de precios',
    example: 'Lista de precios estándar para el primer trimestre de 2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Fecha de vigencia de la lista de precios',
    example: '2024-01-01',
    type: String,
    format: 'date',
  })
  @IsNotEmpty()
  @IsDateString()
  effective_date: string;

  @ApiProperty({
    description: 'Indica si esta es la lista de precios por defecto',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_default?: boolean;

  @ApiProperty({
    description: 'Indica si la lista de precios está activa',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;
}

// DTO para respuesta paginada con estructura meta
export class PaginatedPriceListResponseDto {
  @ApiProperty({ type: Array, description: 'Lista de precios' })
  data: any[];

  @ApiProperty({
    type: 'object',
    properties: {
      total: { type: 'number', example: 100 },
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 10 },
      totalPages: { type: 'number', example: 10 },
    },
    description: 'Metadatos de paginación',
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
