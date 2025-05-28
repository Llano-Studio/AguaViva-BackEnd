import { IsOptional, IsString, IsDateString, IsEnum, IsInt } from 'class-validator';
import { OrderStatus, OrderType } from '../../common/constants/enums';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Término de búsqueda general (busca en múltiples campos)', example: 'juan' })
  searchTerm?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Filtrar por nombre del cliente' })
  customerName?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false, description: 'Filtrar por fecha de pedido desde' })
  orderDateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false, description: 'Filtrar por fecha de pedido hasta' })
  orderDateTo?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  @ApiProperty({ required: false, description: 'Filtrar por estado del pedido', enum: OrderStatus })
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(OrderType)
  @ApiProperty({ required: false, description: 'Filtrar por tipo de pedido', enum: OrderType })
  orderType?: OrderType;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'Filtrar por ID del cliente', type: Number })
  customerId?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'Filtrar por ID del pedido', type: Number })
  orderId?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, description: 'Filtrar por ID de la zona', type: Number })
  zoneId?: number;
} 