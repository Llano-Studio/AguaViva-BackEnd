import { IsInt, IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FilterMultiOneOffPurchasesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por nombre de cliente, ID de compra o descripción de producto',
    example: 'Juan'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del cliente',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  person_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre del cliente',
    example: 'Juan Pérez'
  })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por descripción del producto',
    example: 'Agua'
  })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del producto',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  product_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de compra desde (YYYY-MM-DD)',
    example: '2024-03-01'
  })
  @IsOptional()
  @IsDateString()
  purchaseDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de compra hasta (YYYY-MM-DD)',
    example: '2024-03-31'
  })
  @IsOptional()
  @IsDateString()
  purchaseDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de entrega desde (YYYY-MM-DD)',
    example: '2024-03-01'
  })
  @IsOptional()
  @IsDateString()
  deliveryDateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de entrega hasta (YYYY-MM-DD)',
    example: '2024-03-31'
  })
  @IsOptional()
  @IsDateString()
  deliveryDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del canal de venta',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sale_channel_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de localidad',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locality_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de zona',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zone_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de lista de precios',
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  price_list_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la compra',
    example: 'PENDING',
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED']
  })
  @IsOptional()
  @IsEnum(['PENDING', 'CONFIRMED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del pago',
    example: 'PENDING',
    enum: ['PENDING', 'PARTIAL', 'PAID']
  })
  @IsOptional()
  @IsEnum(['PENDING', 'PARTIAL', 'PAID'])
  payment_status?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la entrega',
    example: 'PENDING',
    enum: ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED']
  })
  @IsOptional()
  @IsEnum(['PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED'])
  delivery_status?: string;
} 