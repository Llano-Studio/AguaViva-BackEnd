import { IsOptional, IsString, IsDateString, IsEnum, IsInt } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderStatus, OrderType } from '../../common/constants/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, description: 'Búsqueda general por cliente, número de pedido, etc.', example: 'juan' })
  search?: string;

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
  @IsDateString()
  @ApiProperty({ required: false, description: 'Filtrar por fecha de entrega desde (YYYY-MM-DD)' })
  deliveryDateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({ required: false, description: 'Filtrar por fecha de entrega hasta (YYYY-MM-DD)' })
  deliveryDateTo?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  @ApiProperty({ required: false, description: 'Filtrar por estado del pedido (para compatibilidad)', enum: OrderStatus })
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples estados del pedido. Puede ser un array o string separado por comas "PENDING,DELIVERED,CANCELLED"',
    example: [OrderStatus.PENDING, OrderStatus.DELIVERED],
    enum: OrderStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      const statuses = value.split(',').map(status => status.trim()).filter(status => Object.values(OrderStatus).includes(status as OrderStatus));
      return statuses.length > 0 ? statuses : undefined;
    }
    if (Array.isArray(value)) {
      const statuses = value.filter(status => Object.values(OrderStatus).includes(status));
      return statuses.length > 0 ? statuses : undefined;
    }
    return undefined;
  })
  statuses?: OrderStatus[];

  @IsOptional()
  @IsEnum(OrderType)
  @ApiProperty({ required: false, description: 'Filtrar por tipo de pedido (para compatibilidad)', enum: OrderType })
  orderType?: OrderType;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples tipos de pedido. Puede ser un array o string separado por comas "SUBSCRIPTION,ONE_OFF,HYBRID"',
    example: [OrderType.SUBSCRIPTION, OrderType.ONE_OFF],
    enum: OrderType,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      const types = value.split(',').map(type => type.trim()).filter(type => Object.values(OrderType).includes(type as OrderType));
      return types.length > 0 ? types : undefined;
    }
    if (Array.isArray(value)) {
      const types = value.filter(type => Object.values(OrderType).includes(type));
      return types.length > 0 ? types : undefined;
    }
    return undefined;
  })
  orderTypes?: OrderType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({ required: false, description: 'Filtrar por ID del cliente (para compatibilidad)', type: Number })
  customerId?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples IDs de clientes. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      const ids = value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map(id => parseInt(id)).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  customerIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({ required: false, description: 'Filtrar por ID del pedido', type: Number })
  orderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({ required: false, description: 'Filtrar por ID de la zona (para compatibilidad)', type: Number })
  zoneId?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples IDs de zonas. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    
    if (typeof value === 'string') {
      const ids = value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map(id => parseInt(id)).filter(id => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  zoneIds?: number[];
}