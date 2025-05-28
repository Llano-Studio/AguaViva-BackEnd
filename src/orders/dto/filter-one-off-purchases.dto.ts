import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterOneOffPurchasesDto extends PaginationQueryDto {
  @IsOptional()
  @IsInt()
  person_id?: number;

  @IsOptional()
  @IsString()
  customerName?: string; // Renombrado desde customer_name y hecho opcional

  @IsOptional()
  @IsInt()
  product_id?: number;

  @IsOptional()
  @IsDateString()
  purchaseDateFrom?: string; // Renombrado desde purchase_date_from

  @IsOptional()
  @IsDateString()
  purchaseDateTo?: string; // Renombrado desde purchase_date_to

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
  @IsString()
  searchTerm?: string; // Añadido

  @IsOptional()
  @IsString()
  productName?: string; // Añadido
} 