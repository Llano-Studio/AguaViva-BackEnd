import {
  IsOptional, IsInt, IsDateString, IsEnum, IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComodatoStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

// helper genérico para números
const toOptionalNumber = ({ value }: { value: any }) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

// helper para strings (evitar strings vacíos)
const toOptionalString = ({ value }: { value: any }) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed === '' ? undefined : trimmed;
};

// helper para enum (normalizar mayúsculas/vacios)
const toOptionalUpper = ({ value }: { value: any }) => {
  if (value === undefined || value === null || value === '') return undefined;
  return String(value).trim().toUpperCase();
};

// helper para fechas (permitir vacío)
const toOptionalDateStr = ({ value }: { value: any }) =>
  value === undefined || value === null || String(value).trim() === '' ? undefined : value;

export class FilterComodatosDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrar por ID de persona/cliente' })
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  person_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filtrar por ID de producto' })
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  product_id?: number;

  @ApiPropertyOptional({
    example: 'ACTIVE',
    enum: ComodatoStatus,
    description: 'Filtrar por estado del comodato',
  })
  @IsOptional()
  @Transform(toOptionalUpper)
  @IsEnum(ComodatoStatus)
  status?: ComodatoStatus;

  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha de entrega desde' })
  @IsOptional()
  @Transform(toOptionalDateStr)
  @IsDateString()
  delivery_date_from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Fecha de entrega hasta' })
  @IsOptional()
  @Transform(toOptionalDateStr)
  @IsDateString()
  delivery_date_to?: string;

  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha de devolución esperada desde' })
  @IsOptional()
  @Transform(toOptionalDateStr)
  @IsDateString()
  expected_return_date_from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Fecha de devolución esperada hasta' })
  @IsOptional()
  @Transform(toOptionalDateStr)
  @IsDateString()
  expected_return_date_to?: string;

  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha de devolución real desde' })
  @IsOptional()
  @Transform(toOptionalDateStr)
  @IsDateString()
  actual_return_date_from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Fecha de devolución real hasta' })
  @IsOptional()
  @Transform(toOptionalDateStr)
  @IsDateString()
  actual_return_date_to?: string;

  @ApiPropertyOptional({ example: 'Juan', description: 'Buscar por nombre de cliente' })
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ example: 'Bidón', description: 'Buscar por nombre de producto' })
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  product_name?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filtrar por zona' })
  @IsOptional()
  @IsInt()
  zone_id?: number;

  @ApiPropertyOptional({ example: 'bidón', description: 'Búsqueda general en notas y nombres' })
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  search?: string;
}
