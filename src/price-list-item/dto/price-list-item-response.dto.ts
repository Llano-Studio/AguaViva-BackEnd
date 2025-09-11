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

  @ApiProperty({
    type: 'object',
    properties: {
      total: { type: 'number', example: 100 },
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 10 },
      totalPages: { type: 'number', example: 10 },
    },
    description: 'Metadatos de paginación',
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
