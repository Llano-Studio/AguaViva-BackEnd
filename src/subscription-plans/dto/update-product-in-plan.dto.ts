import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class UpdateProductInPlanDto {
  @ApiProperty({
    example: 12,
    description: 'Nueva cantidad del producto en este plan',
  })
  @IsInt()
  @IsPositive()
  product_quantity: number;
}
