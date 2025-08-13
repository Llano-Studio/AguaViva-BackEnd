import { IsOptional, IsString, IsDateString, IsBoolean, IsInt } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterOneOffPurchasesDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'ID de la persona' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  person_id?: number;

  @ApiPropertyOptional({ description: 'ID del producto' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  product_id?: number;

  @ApiPropertyOptional({ description: 'ID del canal de venta' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sale_channel_id?: number;

  @ApiPropertyOptional({ description: 'ID de la localidad' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locality_id?: number;

  @ApiPropertyOptional({ description: 'ID de la zona' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zone_id?: number;

  @ApiPropertyOptional({ description: 'Nombre del cliente' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ description: 'Fecha de compra desde' })
  @IsOptional()
  @IsDateString()
  purchaseDateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha de compra hasta' })
  @IsOptional()
  @IsDateString()
  purchaseDateTo?: string;

  @ApiPropertyOptional({ description: 'Fecha de entrega desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  deliveryDateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha de entrega hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  deliveryDateTo?: string;

  @ApiPropertyOptional({ description: 'Búsqueda general' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Nombre del producto' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ description: 'Estado de la orden (PENDING, DELIVERED, CANCELLED) - para compatibilidad' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples estados. Puede ser un array o string separado por comas "PENDING,DELIVERED,CANCELLED"',
    example: ['PENDING', 'DELIVERED'],
    type: [String],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      const statuses = value.split(',').map(status => status.trim()).filter(status => status.length > 0);
      return statuses.length > 0 ? statuses : undefined;
    }
    if (Array.isArray(value)) {
      const statuses = value.filter(status => typeof status === 'string' && status.length > 0);
      return statuses.length > 0 ? statuses : undefined;
    }
    return undefined;
  })
  statuses?: string[];

  @ApiPropertyOptional({ description: 'Filtrar por si requiere entrega (true/false)' })
  @IsOptional()
  @Type(() => Boolean)
  requires_delivery?: boolean;
}