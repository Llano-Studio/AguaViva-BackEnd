import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class AddProductToPlanDto {
  @ApiProperty({ example: 1, description: 'ID del producto a añadir al plan' })
  @IsInt()
  product_id: number;

  @ApiProperty({
    example: 10,
    description: 'Cantidad del producto en este plan',
  })
  @IsInt()
  @IsPositive()
  product_quantity: number;
}
