import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PortalCreateOrderDto, PortalOrderItemDto } from './portal-create-order.dto';

export class PortalUpdateOrderItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  order_item_id?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  product_id: number;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  price_list_id?: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class PortalUpdateOrderDto extends PartialType(PortalCreateOrderDto) {
  @ApiPropertyOptional({ type: [PortalUpdateOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortalUpdateOrderItemDto)
  items_to_update_or_create?: PortalUpdateOrderItemDto[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  item_ids_to_delete?: number[];

  @ApiPropertyOptional({ type: [PortalOrderItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortalOrderItemDto)
  items?: PortalOrderItemDto[];
}
