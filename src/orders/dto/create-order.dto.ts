import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { OrderStatus, OrderType } from '../../common/constants/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'ID del producto a ordenar',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad del producto a ordenar',
    minimum: 1,
    example: 2
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'ID del cliente que realiza el pedido',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  customer_id: number;

  @ApiPropertyOptional({
    description: 'ID del contrato asociado al pedido (opcional)',
    example: 1
  })
  @IsOptional()
  @IsInt()
  contract_id?: number;

  @ApiProperty({
    description: 'ID del canal de venta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  sale_channel_id: number;

  @ApiProperty({
    description: 'Fecha del pedido en formato ISO',
    example: '2024-03-20T10:00:00Z'
  })
  @IsDateString()
  @IsNotEmpty()
  order_date: string;

  @ApiPropertyOptional({
    description: 'Fecha programada de entrega en formato ISO',
    example: '2024-03-21T14:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  scheduled_delivery_date?: string;

  @ApiPropertyOptional({
    description: 'Horario de entrega preferido',
    example: '14:00-16:00'
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  delivery_time?: string;

  @ApiProperty({
    description: 'Monto total del pedido con 2 decimales',
    example: '150.00'
  })
  @IsDecimal({ decimal_digits: '2' })
  @IsNotEmpty()
  total_amount: string;

  @ApiProperty({
    description: 'Monto pagado con 2 decimales',
    example: '150.00'
  })
  @IsDecimal({ decimal_digits: '2' })
  @IsNotEmpty()
  paid_amount: string;

  @ApiProperty({
    description: 'Tipo de pedido',
    enum: OrderType,
    example: OrderType.REGULAR
  })
  @IsEnum(OrderType)
  @IsNotEmpty()
  order_type: OrderType;

  @ApiProperty({
    description: 'Estado del pedido',
    enum: OrderStatus,
    example: OrderStatus.PENDING
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Notas adicionales del pedido',
    maxLength: 500,
    example: 'Entregar en la puerta trasera'
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    description: 'Lista de productos en el pedido',
    type: [CreateOrderItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @IsNotEmpty()
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'ID de la suscripción asociada (si aplica)',
    example: 1,
    type: Number
  })
  @IsOptional()
  @IsInt()
  subscription_id?: number;
} 