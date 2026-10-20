import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** Ítem del inventario del camión tal como lo ve el chofer durante el recorrido. */
export class DriverInventoryItemDto {
  @ApiProperty({ description: 'ID del producto', example: 1 })
  product_id: number;

  @ApiProperty({ description: 'Descripción del producto', example: 'Bidón 20L' })
  description: string;

  @ApiProperty({ description: 'Cantidad cargada inicialmente', example: 20 })
  initial_quantity: number;

  @ApiProperty({ description: 'Cantidad disponible en el camión ahora', example: 14 })
  current_quantity: number;

  @ApiProperty({ description: 'Envases devueltos acumulados', example: 3 })
  returned_quantity: number;

  @ApiProperty({
    description:
      'Cantidad que puede ofrecerse todavía: lo que hay en el camión menos lo ' +
      'comprometido con las paradas sin resolver.',
    example: 6,
  })
  available_quantity: number;
}

export class DriverRouteSheetInventoryDto {
  @ApiProperty({ description: 'ID de la hoja de ruta', example: 1 })
  route_sheet_id: number;

  @ApiProperty({
    description: 'Inventario del vehículo para la hoja de ruta',
    type: [DriverInventoryItemDto],
  })
  items: DriverInventoryItemDto[];

  constructor(partial: Partial<DriverRouteSheetInventoryDto>) {
    Object.assign(this, partial);
  }
}

export class AddDeliveryItemDto {
  @ApiProperty({ description: 'ID del producto a agregar', example: 1 })
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({ description: 'Cantidad a agregar', example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;
}

/**
 * Expansión de la parada actual: el chofer agrega productos que el cliente
 * pide en el momento. No se envían precios: se toman del catálogo del servidor.
 */
export class AddDeliveryItemsDto {
  @ApiProperty({
    description: 'Productos y cantidades a agregar a la parada',
    type: [AddDeliveryItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AddDeliveryItemDto)
  items: AddDeliveryItemDto[];

  @ApiProperty({
    description:
      'Versión del detalle que el chofer tenía a la vista, para detectar datos obsoletos',
    required: false,
    example: 'a1b2c3d4e5f60718',
  })
  @IsString()
  @IsOptional()
  version?: string;
}
