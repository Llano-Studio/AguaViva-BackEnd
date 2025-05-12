import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';

export class FilterOneOffPurchasesDto {
  @IsOptional()
  @IsInt()
  person_id?: number;

  @IsOptional()
  @IsString()
  customerName?: string; // Para buscar por person.name

  @IsOptional()
  @IsInt()
  product_id?: number;

  @IsOptional()
  @IsDateString()
  purchaseDateFrom?: string;

  @IsOptional()
  @IsDateString()
  purchaseDateTo?: string;

  @IsOptional()
  @IsInt()
  sale_channel_id?: number;

  @IsOptional()
  @IsInt()
  locality_id?: number;

  @IsOptional()
  @IsInt()
  zone_id?: number;

  @IsOptional()
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsInt()
  limit?: number = 10;
} 