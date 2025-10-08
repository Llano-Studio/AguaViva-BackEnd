import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VehiculeInventoryResponseDto {
  @ApiProperty({
    description: 'ID único del vehículo',
    example: 1,
  })
  vehicle_id: number;

  @ApiProperty({
    description: 'ID único del producto',
    example: 5,
  })
  product_id: number;

  @ApiProperty({
    description: 'Cantidad cargada del producto en el vehículo',
    example: 100,
    minimum: 0,
  })
  quantity_loaded: number;

  @ApiPropertyOptional({
    description: 'Cantidad vacía del producto en el vehículo',
    example: 20,
    minimum: 0,
  })
  quantity_empty?: number;
}

export class PaginatedVehiculeInventoryResponseDto {
  @ApiProperty({
    type: [VehiculeInventoryResponseDto],
    description: 'Lista de registros de inventario de vehículos',
  })
  data: VehiculeInventoryResponseDto[];

  @ApiProperty({
    description: 'Información de paginación',
    type: 'object',
    properties: {
      total: { type: 'number', example: 50, description: 'Total de registros' },
      page: { type: 'number', example: 1, description: 'Página actual' },
      limit: {
        type: 'number',
        example: 10,
        description: 'Registros por página',
      },
      totalPages: {
        type: 'number',
        example: 5,
        description: 'Total de páginas',
      },
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
