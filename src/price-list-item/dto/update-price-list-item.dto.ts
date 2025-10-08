import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min, IsNotEmpty } from 'class-validator';

export class UpdatePriceListItemDto {
  @ApiProperty({
    description: 'Nuevo precio unitario del producto en esta lista',
    example: 160.0,
    required: true,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unit_price: number;
}
