import {
  PartialType,
  OmitType,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { CreateOrderDto, CreateOrderItemDto } from './create-order.dto';
import {
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTO para un ítem individual durante la actualización de un pedido
export class UpdateOrderItemDto {
  @ApiPropertyOptional({
    description:
      'ID del ítem de orden existente (si se está actualizando un ítem existente)',
    example: 5,
  })
  @IsOptional() // Si está presente, es un ítem existente para actualizar
  @IsInt()
  order_item_id?: number;

  @ApiProperty({
    description: 'ID del producto',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad del producto',
    minimum: 1,
    example: 2,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({
    description:
      '🆕 ID de la lista de precios específica para este producto (opcional)',
    example: 3,
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;

  // Los montos (subtotal, total_amount, amount_paid) se recalcularán en el backend.
  // Si se envían, se pueden ignorar o usar como referencia, pero el backend tiene la última palabra.
  // Por simplicidad, los omitimos aquí para la entrada del DTO de ítem y dejamos que el servicio los calcule.
  // Si necesitaras que el cliente envíe un precio específico (ej. descuento manual en el ítem), se añadirían aquí.
}

export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['items'] as const),
) {
  // Hereda campos opcionales de CreateOrderDto (ej. notes, status, etc.), excluyendo la lista original de 'items'.

  @ApiPropertyOptional({
    description:
      '🆕 Lista de ítems para órdenes híbridas (compatibilidad con estructura legacy)',
    type: [CreateOrderItemDto],
    example: [
      {
        product_id: 1,
        quantity: 4,
        price_list_id: 1,
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items?: CreateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Lista de ítems para actualizar o crear (estructura nueva)',
    type: [UpdateOrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items_to_update_or_create?: UpdateOrderItemDto[];

  @ApiPropertyOptional({
    description: 'Lista de IDs de ítems a eliminar',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  item_ids_to_delete?: number[];
}
