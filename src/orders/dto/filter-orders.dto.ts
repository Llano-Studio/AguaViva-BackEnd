import { IsOptional, IsString, IsDateString, IsEnum, IsInt } from 'class-validator';
import { OrderStatus, OrderType } from '../../common/constants/enums';

export class FilterOrdersDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsDateString()
  orderDateFrom?: string;

  @IsOptional()
  @IsDateString()
  orderDateTo?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(OrderType)
  orderType?: OrderType;

  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsOptional()
  @IsInt()
  page?: number;

  @IsOptional()
  @IsInt()
  limit?: number;
} 