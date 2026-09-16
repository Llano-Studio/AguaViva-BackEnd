import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderStatus, OrderType } from '../../common/constants/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

const parseIdsArray = (value: any): number[] | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const ids = value
      .split(',')
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id));
    return ids.length > 0 ? ids : undefined;
  }
  if (Array.isArray(value)) {
    const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    return ids.length > 0 ? ids : undefined;
  }
  return undefined;
};

const parseEnumArray = <T extends Record<string, string>>(
  value: any,
  enumObj: T,
): T[keyof T][] | undefined => {
  if (!value) return undefined;
  const enumValues = Object.values(enumObj);
  if (typeof value === 'string') {
    const items = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => enumValues.includes(s as T[keyof T]));
    return items.length > 0 ? (items as T[keyof T][]) : undefined;
  }
  if (Array.isArray(value)) {
    const items = value.filter((s) => enumValues.includes(s));
    return items.length > 0 ? items : undefined;
  }
  return undefined;
};

const parseBoolean = (value: any): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const str = String(value).trim().toLowerCase();
  if (str === 'true' || str === '1' || str === 'yes') return true;
  if (str === 'false' || str === '0' || str === 'no') return false;
  return undefined;
};

const parseIntValue = (value: any): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = parseInt(value);
  return isNaN(n) ? undefined : n;
};

const withSnakeAlias = (
  snakeKey: string,
  parser?: (v: any) => any,
): PropertyDecorator =>
  Transform(({ value, obj }) => {
    let resolved: any = value;
    if (
      resolved === undefined ||
      resolved === null ||
      (typeof resolved === 'string' && resolved.trim() === '')
    ) {
      resolved = (obj as any)?.[snakeKey];
    }
    if (parser) return parser(resolved);
    return resolved;
  });

export class FilterOrdersDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Búsqueda general por cliente, número de pedido, etc.',
    example: 'juan',
  })
  search?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    description: 'Filtrar por nombre del cliente',
  })
  @withSnakeAlias('customer_name')
  customerName?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    required: false,
    description: 'Filtrar por fecha de pedido desde',
  })
  @withSnakeAlias('order_date_from')
  orderDateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    required: false,
    description: 'Filtrar por fecha de pedido hasta',
  })
  @withSnakeAlias('order_date_to')
  orderDateTo?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    required: false,
    description: 'Filtrar por fecha de entrega desde (YYYY-MM-DD)',
  })
  @withSnakeAlias('delivery_date_from')
  deliveryDateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiProperty({
    required: false,
    description: 'Filtrar por fecha de entrega hasta (YYYY-MM-DD)',
  })
  @withSnakeAlias('delivery_date_to')
  deliveryDateTo?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  @ApiProperty({
    required: false,
    description: 'Filtrar por estado del pedido (para compatibilidad)',
    enum: OrderStatus,
  })
  status?: OrderStatus;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples estados del pedido. Puede ser un array o string separado por comas "PENDING,DELIVERED,CANCELLED"',
    example: [OrderStatus.PENDING, OrderStatus.DELIVERED],
    enum: OrderStatus,
    isArray: true,
  })
  @IsOptional()
  @withSnakeAlias('statuses', (v) => parseEnumArray(v, OrderStatus))
  statuses?: OrderStatus[];

  @IsOptional()
  @IsEnum(OrderType)
  @ApiProperty({
    required: false,
    description: 'Filtrar por tipo de pedido (para compatibilidad)',
    enum: OrderType,
  })
  orderType?: OrderType;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples tipos de pedido. Puede ser un array o string separado por comas "SUBSCRIPTION,ONE_OFF,HYBRID"',
    example: [OrderType.SUBSCRIPTION, OrderType.ONE_OFF],
    enum: OrderType,
    isArray: true,
  })
  @IsOptional()
  @withSnakeAlias('order_types', (v) => parseEnumArray(v, OrderType))
  orderTypes?: OrderType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({
    required: false,
    description: 'Filtrar por ID del cliente (para compatibilidad)',
    type: Number,
  })
  @withSnakeAlias('customer_id', parseIntValue)
  customerId?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples IDs de clientes. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @withSnakeAlias('customer_ids', parseIdsArray)
  customerIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({
    required: false,
    description: 'Filtrar por ID del pedido',
    type: Number,
  })
  @withSnakeAlias('order_id', parseIntValue)
  orderId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({
    required: false,
    description: 'Filtrar por ID de la zona (para compatibilidad)',
    type: Number,
  })
  @withSnakeAlias('zone_id', parseIntValue)
  zoneId?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples IDs de zonas. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @withSnakeAlias('zone_ids', parseIdsArray)
  zoneIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiProperty({
    required: false,
    description: 'Filtrar por ID del vehículo (para compatibilidad)',
    type: Number,
  })
  @withSnakeAlias('vehicle_id', parseIntValue)
  vehicleId?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples IDs de vehículos. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @withSnakeAlias('vehicle_ids', parseIdsArray)
  vehicleIds?: number[];

  @IsOptional()
  @ApiPropertyOptional({
    description:
      'Filtrar solo pedidos que requieren entrega (true) o retiro en local (false). Si requieren entrega, tienen scheduled_delivery_date definido.',
    type: Boolean,
  })
  @withSnakeAlias('requires_delivery', parseBoolean)
  requiresDelivery?: boolean;
}
