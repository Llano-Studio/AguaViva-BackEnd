import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerSearchDto {
  @ApiPropertyOptional({
    description: 'Término de búsqueda (nombre, teléfono, ID)',
    example: 'Juan Pérez'
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({
    description: 'ID de la zona para filtrar',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  zone_id?: number;

  @ApiPropertyOptional({
    description: 'ID de la localidad para filtrar',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  locality_id?: number;

  @ApiPropertyOptional({
    description: 'Número de página',
    example: 1,
    default: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Elementos por página',
    example: 10,
    default: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}

export class CustomerSearchResultDto {
  @ApiPropertyOptional({
    description: 'ID de la persona',
    example: 1
  })
  person_id: number;

  @ApiPropertyOptional({
    description: 'Nombre del cliente',
    example: 'Juan Pérez'
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Teléfono del cliente',
    example: '+54911234567'
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Dirección del cliente',
    example: 'Av. Corrientes 1234'
  })
  address: string;

  @ApiPropertyOptional({
    description: 'Nombre de la zona',
    example: 'Centro'
  })
  zone_name: string;

  @ApiPropertyOptional({
    description: 'Cantidad de suscripciones activas',
    example: 2
  })
  active_subscriptions: number;

  @ApiPropertyOptional({
    description: 'Cantidad de ciclos pendientes',
    example: 3
  })
  pending_cycles: number;

  @ApiPropertyOptional({
    description: 'Total de saldo pendiente',
    example: 750.00
  })
  total_pending: number;
}

export class CustomerSearchResponseDto {
  @ApiPropertyOptional({
    description: 'Lista de clientes encontrados',
    type: [CustomerSearchResultDto]
  })
  customers: CustomerSearchResultDto[];

  @ApiPropertyOptional({
    description: 'Total de clientes',
    example: 25
  })
  total: number;

  @ApiPropertyOptional({
    description: 'Página actual',
    example: 1
  })
  page: number;

  @ApiPropertyOptional({
    description: 'Total de páginas',
    example: 3
  })
  totalPages: number;
}