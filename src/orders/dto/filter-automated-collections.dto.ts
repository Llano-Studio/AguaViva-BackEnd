import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '../../common/constants/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterAutomatedCollectionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Búsqueda general por cliente, número de pedido, etc.',
    example: 'juan',
  })
  search?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Filtrar por nombre del cliente',
    example: 'Juan Pérez',
  })
  customerName?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filtrar por fecha de pedido desde (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  orderDateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filtrar por fecha de pedido hasta (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  orderDateTo?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filtrar por fecha de vencimiento desde (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Filtrar por fecha de vencimiento hasta (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  dueDateTo?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples estados del pedido',
    example: [OrderStatus.PENDING, OrderStatus.DELIVERED],
    enum: OrderStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      const statuses = value
        .split(',')
        .map((status) => status.trim())
        .filter((status) =>
          Object.values(OrderStatus).includes(status as OrderStatus),
        );
      return statuses.length > 0 ? statuses : undefined;
    }
    if (Array.isArray(value)) {
      const statuses = value.filter((status) =>
        Object.values(OrderStatus).includes(status),
      );
      return statuses.length > 0 ? statuses : undefined;
    }
    return undefined;
  })
  statuses?: OrderStatus[];

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples estados de pago',
    example: [PaymentStatus.PENDING, PaymentStatus.PAID],
    enum: PaymentStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      const paymentStatuses = value
        .split(',')
        .map((status) => status.trim())
        .filter((status) =>
          Object.values(PaymentStatus).includes(status as PaymentStatus),
        );
      return paymentStatuses.length > 0 ? paymentStatuses : undefined;
    }
    if (Array.isArray(value)) {
      const paymentStatuses = value.filter((status) =>
        Object.values(PaymentStatus).includes(status),
      );
      return paymentStatuses.length > 0 ? paymentStatuses : undefined;
    }
    return undefined;
  })
  paymentStatuses?: PaymentStatus[];

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples IDs de clientes',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
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
  })
  customerIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({
    description: 'Filtrar por ID del pedido específico',
    type: Number,
    example: 123,
  })
  orderId?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por múltiples IDs de zonas',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
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
  })
  zoneIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({
    description: 'Filtrar por ID del plan de suscripción',
    type: Number,
    example: 1,
  })
  subscriptionPlanId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Filtrar por monto mínimo',
    example: '100.00',
  })
  minAmount?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Filtrar por monto máximo',
    example: '500.00',
  })
  maxAmount?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Filtrar solo cobranzas vencidas (true/false)',
    example: 'true',
  })
  overdue?: string;
}
