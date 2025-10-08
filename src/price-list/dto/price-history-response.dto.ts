import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PriceHistoryResponseDto {
  @ApiProperty({
    description: 'ID del registro de historial',
    example: 1,
  })
  history_id: number;

  @ApiProperty({
    description: 'ID del item de la lista de precios relacionado',
    example: 1,
  })
  price_list_item_id: number;

  @ApiPropertyOptional({
    description: 'ID del producto relacionado al ítem',
    example: 101,
  })
  product_id?: number;

  @ApiPropertyOptional({
    description: 'Nombre del producto relacionado al ítem',
    example: 'Agua Bidón 20L',
  })
  product_name?: string;

  @ApiProperty({
    description: 'Precio anterior',
    example: '100.00',
  })
  previous_price: string;

  @ApiProperty({
    description: 'Nuevo precio',
    example: '120.00',
  })
  new_price: string;

  @ApiProperty({
    description: 'Fecha del cambio',
    example: '2023-01-01T12:00:00Z',
  })
  change_date: string;

  @ApiPropertyOptional({
    description: 'Porcentaje de cambio',
    example: '20.00',
    required: false,
  })
  change_percentage?: string;

  @ApiPropertyOptional({
    description: 'Razón del cambio',
    example: 'Ajuste por inflación',
    required: false,
  })
  change_reason?: string;

  @ApiPropertyOptional({
    description: 'Usuario que realizó el cambio',
    example: 'admin@example.com',
    required: false,
  })
  created_by?: string;

  constructor(partial: Partial<PriceHistoryResponseDto>) {
    Object.assign(this, partial);
  }
}
