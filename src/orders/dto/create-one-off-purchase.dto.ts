import { IsInt, IsNotEmpty, IsOptional, IsString, Min, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOneOffPurchaseDto {
  @ApiProperty({
    description: 'ID de la persona que realiza la compra',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  person_id: number;

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

  @ApiProperty({
    description: 'ID del canal de venta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  sale_channel_id: number;

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

  // total_amount y purchase_date se gestionarán en el backend.
} 