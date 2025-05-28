import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VehicleResponseDto {
  @ApiProperty({ example: 1, description: 'ID único del vehículo' })
  vehicle_id: number;

  @ApiProperty({ example: 'TRUCK-001', description: 'Código interno del vehículo', uniqueItems: true })
  code: string;

  @ApiProperty({ example: 'Ford Cargo 1722', description: 'Nombre o modelo del vehículo' })
  name: string;

  @ApiPropertyOptional({ example: 'Camión de reparto principal con capacidad extendida', description: 'Descripción adicional del vehículo', nullable: true })
  description?: string;
}

export class PaginatedVehicleResponseDto {
  @ApiProperty({ type: [VehicleResponseDto] })
  data: VehicleResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 5, nullable: true })
  totalPages?: number;
} 