import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateOneOffPurchaseDto {
  @IsInt()
  @IsNotEmpty()
  person_id: number;

  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @IsInt()
  @IsNotEmpty()
  sale_channel_id: number;

  @IsOptional()
  @IsString()
  delivery_address?: string;

  @IsOptional()
  @IsInt()
  locality_id?: number;

  @IsOptional()
  @IsInt()
  zone_id?: number;

  // total_amount y purchase_date se gestionarán en el backend.
} 