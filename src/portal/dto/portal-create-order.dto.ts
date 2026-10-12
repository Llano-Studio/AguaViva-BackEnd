import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PortalOrderItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

/**
 * El precio, la lista de precios, el contrato y la fecha del pedido los
 * resuelve el servidor: el cliente solo elige productos, cantidades y entrega.
 */
export class PortalCreateOrderDto {
  @ApiPropertyOptional({
    description:
      'Abono al que se descuenta el pedido. Solo hace falta si el cliente tiene más de un abono activo.',
    example: 6,
  })
  @IsOptional()
  @IsInt()
  subscription_id?: number;

  @ApiPropertyOptional({ example: '2026-08-12T14:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduled_delivery_date?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  delivery_time?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ type: [PortalOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortalOrderItemDto)
  items: PortalOrderItemDto[];
}
