import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { OrderStatus, OrigenPedido } from '../../common/constants/enums';

export class PortalFilterOrdersDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'order_date:desc' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'order_date:desc';

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrigenPedido })
  @IsOptional()
  @IsEnum(OrigenPedido)
  origen_pedido?: OrigenPedido;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  orderDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  orderDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      const arr = value.split(',').map((v) => v.trim()).filter(Boolean);
      return arr.length > 0 ? arr : undefined;
    }
    if (Array.isArray(value)) {
      return value.filter((v) => typeof v === 'string' && v.length > 0);
    }
    return undefined;
  })
  statuses?: string[];
}
