import { ApiProperty } from '@nestjs/swagger';

export class InventoryResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID del producto',
  })
  product_id: number;

  @ApiProperty({
    example: 1,
    description: 'ID del almacén',
  })
  warehouse_id: number;

  @ApiProperty({
    example: 100,
    description: 'Cantidad de stock',
  })
  quantity: number;

  @ApiProperty({
    example: 'Agua Bidón 20L',
    description: 'Descripción del producto',
  })
  product_description: string;

  @ApiProperty({
    example: 'Almacén Principal',
    description: 'Nombre del almacén',
  })
  warehouse_name: string;

  @ApiProperty({
    example: '2024-01-15T10:30:00Z',
    description: 'Fecha de creación del inventario',
  })
  created_at: string;
}
