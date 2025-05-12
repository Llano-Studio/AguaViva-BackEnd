import { IsInt, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class CreatePriceListItemDto {
  @IsInt()
  @IsNotEmpty()
  price_list_id: number;

  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  unit_price: number;
} 