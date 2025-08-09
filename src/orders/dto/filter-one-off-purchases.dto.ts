import { IsOptional, IsString, IsDateString, IsInt, IsBoolean} from 'class-validator';
import { Type } from 'class-transformer';
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

  @ApiPropertyOptional({ description: 'Estado de la orden (PENDING, DELIVERED, CANCELLED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filtrar por si requiere entrega (true/false)' })
  @IsOptional()
  @Type(() => Boolean)
  requires_delivery?: boolean;
}