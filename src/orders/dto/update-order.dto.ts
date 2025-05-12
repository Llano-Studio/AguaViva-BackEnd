import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateOrderDto, CreateOrderItemDto } from './create-order.dto';
import { IsOptional, IsInt, IsArray, ValidateNested, IsNotEmpty, Min, IsDecimal } from 'class-validator';
import { Type } from 'class-transformer';

// DTO para un ítem individual durante la actualización de un pedido
export class UpdateOrderItemDto {
  @IsOptional() // Si está presente, es un ítem existente para actualizar
  @IsInt()
  order_item_id?: number;

  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  // Los montos (subtotal, total_amount, amount_paid) se recalcularán en el backend.
  // Si se envían, se pueden ignorar o usar como referencia, pero el backend tiene la última palabra.
  // Por simplicidad, los omitimos aquí para la entrada del DTO de ítem y dejamos que el servicio los calcule.
  // Si necesitaras que el cliente envíe un precio específico (ej. descuento manual en el ítem), se añadirían aquí.
}

export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['items'] as const),
) {
  // Hereda campos opcionales de CreateOrderDto (ej. notes, status, etc.), excluyendo la lista original de 'items'.

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  items_to_update_or_create?: UpdateOrderItemDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  item_ids_to_delete?: number[];
} 