import {
  IsOptional,
  IsInt,
  IsDateString,
  IsEnum,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComodatoStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterComodatosDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Filtrar por ID de persona/cliente' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  person_id?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filtrar por ID de producto' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  product_id?: number;

  @ApiPropertyOptional({ 
    example: 'ACTIVE', 
    enum: ComodatoStatus, 
    description: 'Filtrar por estado del comodato' 
  })
  @IsOptional()
  @IsEnum(ComodatoStatus)
  status?: ComodatoStatus;

  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha de entrega desde' })
  @IsOptional()
  @IsDateString()
  delivery_date_from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Fecha de entrega hasta' })
  @IsOptional()
  @IsDateString()
  delivery_date_to?: string;

  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha de devolución esperada desde' })
  @IsOptional()
  @IsDateString()
  expected_return_date_from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Fecha de devolución esperada hasta' })
  @IsOptional()
  @IsDateString()
  expected_return_date_to?: string;

  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha de devolución real desde' })
  @IsOptional()
  @IsDateString()
  actual_return_date_from?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Fecha de devolución real hasta' })
  @IsOptional()
  @IsDateString()
  actual_return_date_to?: string;

  @ApiPropertyOptional({ example: 'Juan', description: 'Buscar por nombre de cliente' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ example: 'Bidón', description: 'Buscar por nombre de producto' })
  @IsOptional()
  @IsString()
  product_name?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filtrar por zona' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zone_id?: number;

  @ApiPropertyOptional({ example: 'bidón', description: 'Búsqueda general en notas y nombres' })
  @IsOptional()
  @IsString()
  search?: string;
}