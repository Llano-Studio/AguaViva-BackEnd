import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreatePriceListItemDto {
  @ApiProperty({
    description: 'ID de la lista de precios a la que pertenece el ítem',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  price_list_id: number;

  @ApiProperty({
    description: 'ID del producto para este ítem de lista de precios',
    example: 101,
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Precio unitario del producto en esta lista',
    example: 150.75,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unit_price: number;
}
