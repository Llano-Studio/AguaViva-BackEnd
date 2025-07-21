import { IsInt, IsOptional, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterOneOffPurchasesDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  person_id?: number;

  @IsOptional()
  @IsString()
  customerName?: string; // Renombrado desde customer_name y hecho opcional

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  product_id?: number;

  @IsOptional()
  @IsDateString()
  purchaseDateFrom?: string; // Renombrado desde purchase_date_from

  @IsOptional()
  @IsDateString()
  purchaseDateTo?: string; // Renombrado desde purchase_date_to

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sale_channel_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  locality_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  zone_id?: number;

  @IsOptional()
  @IsString()
  search?: string; // Búsqueda general

  @IsOptional()
  @IsString()
  productName?: string; // Añadido
} 