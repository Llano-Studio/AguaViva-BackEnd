import { IsInt, IsNotEmpty, IsOptional, IsString, Min, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOneOffPurchaseItemDto {
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
}

export class CreateOneOffPurchaseDto {
  @ApiProperty({
    description: 'ID de la persona que realiza la compra',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  person_id: number;

  @ApiProperty({
    description: 'Lista de productos a comprar',
    type: [CreateOneOffPurchaseItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOneOffPurchaseItemDto)
  @IsNotEmpty()
  items: CreateOneOffPurchaseItemDto[];

  @ApiProperty({
    description: 'ID del canal de venta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  sale_channel_id: number;

  @ApiPropertyOptional({
    description: 'ID de la lista de precios a usar (opcional, si no se especifica usa la lista estándar)',
    example: 1
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;

  @ApiPropertyOptional({
    description: 'Dirección de entrega específica (opcional)',
    example: 'Av. Principal 123, Apto 4B'
  })
  @IsOptional()
  @IsString()
  delivery_address?: string;

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
    description: 'Fecha de la compra en formato ISO (si no se especifica, se usa la fecha actual)',
    example: '2024-03-20T10:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  // total_amount se calcula automáticamente en el backend basado en los items y la lista de precios seleccionada.
} 