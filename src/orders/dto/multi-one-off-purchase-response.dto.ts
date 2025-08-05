import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MultiOneOffPurchaseItemResponseDto {
  @ApiProperty({ description: 'ID del ítem de compra', example: 1 })
  purchase_item_id: number;

  @ApiProperty({ description: 'ID del producto', example: 1 })
  product_id: number;

  @ApiProperty({ description: 'Cantidad comprada', example: 2 })
  quantity: number;

  @ApiProperty({ description: 'Precio unitario aplicado', example: '25.50' })
  unit_price: string;

  @ApiProperty({ description: 'Subtotal del ítem', example: '51.00' })
  subtotal: string;

  @ApiPropertyOptional({ description: 'ID de la lista de precios utilizada para este producto', example: 3 })
  price_list_id?: number;

  @ApiPropertyOptional({ description: 'Notas del ítem', example: 'Extra frío' })
  notes?: string;

  @ApiProperty({
    description: 'Información del producto',
    type: 'object',
    properties: {
      product_id: { type: 'number', example: 1 },
      description: { type: 'string', example: 'Agua Mineral 500ml' },
      price: { type: 'string', example: '25.50' },
      is_returnable: { type: 'boolean', example: true }
    }
  })
  product: {
    product_id: number;
    description: string;
    price: string;
    is_returnable: boolean;
  };

  @ApiPropertyOptional({
    description: 'Información de la lista de precios utilizada para este producto',
    type: 'object',
    nullable: true,
    properties: {
      price_list_id: { type: 'number', example: 3 },
      name: { type: 'string', example: 'Lista Corporativa' }
    }
  })
  price_list?: {
    price_list_id: number;
    name: string;
  };
}

export class MultiOneOffPurchaseResponseDto {
  @ApiProperty({ description: 'ID de la compra', example: 1 })
  purchase_header_id: number;

  @ApiProperty({ description: 'ID de la persona que realizó la compra', example: 1 })
  person_id: number;

  @ApiProperty({ description: 'ID del canal de venta', example: 1 })
  sale_channel_id: number;

  @ApiProperty({ description: 'Fecha de la compra', example: '2024-03-20T10:00:00.000Z' })
  purchase_date: string;

  @ApiPropertyOptional({ description: 'Fecha programada de entrega', example: '2024-03-21T14:00:00.000Z' })
  scheduled_delivery_date?: string;

  @ApiProperty({ description: 'Monto total de la compra', example: '125.50' })
  total_amount: string;

  @ApiProperty({ description: 'Monto pagado', example: '125.50' })
  paid_amount: string;

  @ApiPropertyOptional({ description: 'Dirección de entrega', example: 'Av. Principal 123, Barrio Centro' })
  delivery_address?: string;

  @ApiPropertyOptional({ description: 'ID de la localidad', example: 1 })
  locality_id?: number;

  @ApiPropertyOptional({ description: 'ID de la zona', example: 1 })
  zone_id?: number;

  @ApiPropertyOptional({ description: 'Notas generales', example: 'Cliente frecuente' })
  notes?: string;

  @ApiProperty({ description: 'Estado de la compra', example: 'PENDING' })
  status: string;

  @ApiProperty({ description: 'Estado del pago', example: 'PENDING' })
  payment_status: string;

  @ApiProperty({ description: 'Estado de la entrega', example: 'PENDING' })
  delivery_status: string;

  @ApiProperty({ description: 'Fecha de creación', example: '2024-03-20T10:00:00.000Z' })
  created_at: string;

  @ApiProperty({ description: 'Fecha de última actualización', example: '2024-03-20T10:00:00.000Z' })
  updated_at: string;

  @ApiProperty({
    description: 'Información de la persona',
    type: 'object',
    properties: {
      person_id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Juan Pérez' },
      phone: { type: 'string', example: '+595981234567' },
      tax_id: { type: 'string', example: '12345678-9', nullable: true }
    }
  })
  person: {
    person_id: number;
    name: string;
    phone: string;
    tax_id?: string;
  };

  @ApiProperty({
    description: 'Información del canal de venta',
    type: 'object',
    properties: {
      sale_channel_id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Tienda Online' }
    }
  })
  sale_channel: {
    sale_channel_id: number;
    name: string;
  };

  @ApiPropertyOptional({
    description: 'Información de la localidad',
    type: 'object',
    nullable: true,
    properties: {
      locality_id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Centro' }
    }
  })
  locality?: {
    locality_id: number;
    name: string;
  };

  @ApiPropertyOptional({
    description: 'Información de la zona',
    type: 'object',
    nullable: true,
    properties: {
      zone_id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Zona Centro' }
    }
  })
  zone?: {
    zone_id: number;
    name: string;
  };

  @ApiProperty({
    description: 'Lista de productos comprados con sus listas de precios individuales',
    type: [MultiOneOffPurchaseItemResponseDto]
  })
  purchase_items: MultiOneOffPurchaseItemResponseDto[];
}