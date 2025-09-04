import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsString, IsInt, IsArray, ValidateNested, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOneOffPurchaseItemDto {
  @ApiProperty({
    description: 'ID del producto',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad del producto',
    minimum: 1,
    example: 2
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({
    description: 'ID de la lista de precios (opcional, usa la lista por defecto si no se especifica)',
    example: 1
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;
}

export class UpdateOneOffPurchaseDto {
    @ApiProperty({
        description: 'Lista de productos a actualizar. Estructura simplificada con product_id y quantity.',
        type: [UpdateOneOffPurchaseItemDto],
        example: [{ product_id: 1, quantity: 2 }]
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateOneOffPurchaseItemDto)
    @IsNotEmpty()
    items: UpdateOneOffPurchaseItemDto[];

    @ApiPropertyOptional({
        description: 'ID del canal de venta',
        example: 1
    })
    @IsOptional()
    @IsInt()
    sale_channel_id?: number;

    @ApiPropertyOptional({
        description: 'ID de la localidad para la entrega',
        example: 1
    })
    @IsOptional()
    @IsInt()
    locality_id?: number;

    @ApiPropertyOptional({
        description: 'ID de la zona para la entrega',
        example: 1
    })
    @IsOptional()
    @IsInt()
    zone_id?: number;

    @ApiPropertyOptional({
        description: 'Dirección de entrega específica',
        example: 'Av. Principal 123, Apto 4B'
    })
    @IsOptional()
    @IsString()
    delivery_address?: string;

    @ApiPropertyOptional({
        description: 'Fecha de la compra en formato ISO',
        example: '2024-03-20T10:00:00Z'
    })
    @IsOptional()
    @IsDateString()
    purchase_date?: string;

    @ApiPropertyOptional({
        description: 'Fecha programada de entrega en formato ISO',
        example: '2024-03-21T14:00:00Z'
    })
    @IsOptional()
    @IsDateString()
    scheduled_delivery_date?: string;

    @ApiPropertyOptional({
        description: 'Rango de horario de entrega',
        example: '9:00 AM - 12:00 PM'
    })
    @IsOptional()
    @IsString()
    delivery_time?: string;

    @ApiPropertyOptional({
        description: 'Monto pagado por el cliente',
        example: '1500.00'
    })
    @IsOptional()
    @IsString()
    paid_amount?: string;

    @ApiPropertyOptional({
        description: 'Notas adicionales sobre la compra',
        example: 'Cliente prefiere entrega por la mañana'
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({
        description: 'Estado de la orden (PENDING, DELIVERED, CANCELLED)',
        example: 'DELIVERED',
        enum: ['PENDING', 'DELIVERED', 'CANCELLED']
    })
    @IsOptional()
    @IsString()
    status?: string;
}