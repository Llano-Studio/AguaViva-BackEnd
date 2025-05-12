import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductDto } from './route-sheet-response.dto';

export class InventoryItemDto {
  @ApiProperty({
    description: 'ID del producto',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad inicial cargada',
    example: 20
  })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  initial_quantity: number;

  @ApiPropertyOptional({
    description: 'Cantidad actual (se actualizará durante la ruta)',
    example: 15
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  current_quantity?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de envases devueltos',
    example: 10
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  returned_quantity?: number = 0;
}

export class CreateVehicleRouteInventoryDto {
  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  route_sheet_id: number;

  @ApiProperty({
    description: 'Ítems de inventario',
    type: [InventoryItemDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryItemDto)
  items: InventoryItemDto[];
}

export class VehicleInventoryItemResponseDto {
  @ApiProperty({
    description: 'ID del inventario',
    example: 1
  })
  inventory_id: number;

  @ApiProperty({
    description: 'Producto',
    type: ProductDto
  })
  product: ProductDto;

  @ApiProperty({
    description: 'Cantidad inicial cargada',
    example: 20
  })
  initial_quantity: number;

  @ApiProperty({
    description: 'Cantidad actual',
    example: 15
  })
  current_quantity: number;

  @ApiProperty({
    description: 'Cantidad de envases devueltos',
    example: 10
  })
  returned_quantity: number;
}

export class VehicleRouteInventoryResponseDto {
  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 1
  })
  route_sheet_id: number;

  @ApiProperty({
    description: 'Ítems de inventario',
    type: [VehicleInventoryItemResponseDto]
  })
  items: VehicleInventoryItemResponseDto[];

  constructor(partial: Partial<VehicleRouteInventoryResponseDto>) {
    Object.assign(this, partial);
  }
}

export class InventoryTransactionDto {
  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  route_sheet_id: number;

  @ApiPropertyOptional({
    description: 'ID del detalle de la entrega (si aplica)',
    example: 1
  })
  @IsInt()
  @IsOptional()
  detail_id?: number;

  @ApiProperty({
    description: 'ID del producto',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad (positivo para carga, negativo para entrega/devolución)',
    example: -2
  })
  @IsInt()
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    description: 'Tipo de transacción',
    example: 'DELIVERY',
    enum: ['LOAD', 'DELIVERY', 'RETURN']
  })
  @IsNotEmpty()
  transaction_type: 'LOAD' | 'DELIVERY' | 'RETURN';
} 