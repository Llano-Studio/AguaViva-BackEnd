import { ApiProperty } from '@nestjs/swagger';

// Clases DTO simplificadas para las relaciones
class ProductResponseForListItemDto {
  @ApiProperty()
  product_id: number;

  @ApiProperty()
  description: string;

  @ApiProperty({ nullable: true })
  code?: string;
}

class PriceListResponseForListItemDto {
  @ApiProperty()
  price_list_id: number;

  @ApiProperty()
  name: string;
}

export class PriceListItemResponseDto {
  @ApiProperty()
  price_list_item_id: number;

  @ApiProperty()
  price_list_id: number;

  @ApiProperty({ type: () => PriceListResponseForListItemDto, required: false })
  price_list?: PriceListResponseForListItemDto;

  @ApiProperty()
  product_id: number;

  @ApiProperty({ type: () => ProductResponseForListItemDto, required: false })
  product?: ProductResponseForListItemDto;

  @ApiProperty({ type: 'number', format: 'float' })
  unit_price: number;
}

export class PaginatedPriceListItemResponseDto {
  @ApiProperty({ type: [PriceListItemResponseDto] })
  data: PriceListItemResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10, nullable: true })
  totalPages?: number;
} 