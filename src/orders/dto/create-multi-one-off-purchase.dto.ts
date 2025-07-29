import { IsInt, IsNotEmpty, IsOptional, IsString, Min, IsDateString, IsArray, ValidateNested, IsDecimal, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class CreateMultiOneOffPurchaseItemDto {
  @ApiProperty({
    description: 'ID del producto a comprar',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad del producto a comprar',
    minimum: 1,
    example: 2
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({
    description: 'ID de la lista de precios específica para este producto (opcional). Si no se especifica, usa la lista general.',
    example: 3
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;

  @ApiPropertyOptional({
    description: 'Notas específicas para este producto (opcional)',
    example: 'Sin hielo'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateMultiOneOffPurchaseDto {
  @ApiProperty({
    description: 'ID de la persona que realiza la compra',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  person_id: number;

  @ApiProperty({
    description: `Lista de productos a comprar con sus cantidades y listas de precios individuales.
    
🆕 NUEVA FUNCIONALIDAD: Cada producto puede tener su propia lista de precios.

Ejemplos:
- Producto con lista corporativa: { "product_id": 1, "quantity": 2, "price_list_id": 3 }
- Producto con lista promocional: { "product_id": 2, "quantity": 1, "price_list_id": 5 }  
- Producto con lista general: { "product_id": 3, "quantity": 1 } (sin price_list_id)`,
    type: [CreateMultiOneOffPurchaseItemDto],
    example: [
      { product_id: 1, quantity: 2, price_list_id: 3, notes: 'Extra frío' },
      { product_id: 3, quantity: 1, price_list_id: 5 },
      { product_id: 5, quantity: 1 }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMultiOneOffPurchaseItemDto)
  @IsNotEmpty()
  items: CreateMultiOneOffPurchaseItemDto[];

  @ApiProperty({
    description: 'ID del canal de venta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  sale_channel_id: number;

  @ApiPropertyOptional({
    description: 'Dirección de entrega específica para esta compra',
    example: 'Av. Principal 123, Barrio Centro'
  })
  @IsOptional()
  @IsString()
  delivery_address?: string;

  @ApiPropertyOptional({
    description: 'ID de la localidad donde se realizará la entrega',
    example: 1
  })
  @IsOptional()
  @IsInt()
  locality_id?: number;

  @ApiPropertyOptional({
    description: 'ID de la zona donde se realizará la entrega',
    example: 1
  })
  @IsOptional()
  @IsInt()
  zone_id?: number;

  @ApiPropertyOptional({
    description: 'Fecha de la compra (opcional). Si no se especifica, usa la fecha actual.',
    example: '2024-03-20T10:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @ApiPropertyOptional({
    description: 'Monto pagado hasta el momento',
    example: '150.50',
    type: 'string'
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' }, { message: 'El monto pagado debe tener máximo 2 decimales' })
  paid_amount?: string;

  @ApiPropertyOptional({
    description: 'Notas generales sobre la compra',
    example: 'Cliente frecuente, entrega prioritaria'
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Estado de la compra',
    example: 'PENDING',
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED']
  })
  @IsOptional()
  @IsEnum(['PENDING', 'CONFIRMED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Estado del pago',
    example: 'PENDING',
    enum: ['PENDING', 'PARTIAL', 'PAID']
  })
  @IsOptional()
  @IsEnum(['PENDING', 'PARTIAL', 'PAID'])
  payment_status?: string;

  @ApiPropertyOptional({
    description: 'Estado de la entrega',
    example: 'PENDING',
    enum: ['PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED']
  })
  @IsOptional()
  @IsEnum(['PENDING', 'IN_TRANSIT', 'DELIVERED', 'FAILED'])
  delivery_status?: string;
} 