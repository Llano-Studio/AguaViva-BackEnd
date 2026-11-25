import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Punto marcado a mano por administración. */
export class SetPersonLocationDto {
  @ApiProperty({ example: -27.4512345, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: -58.9867654, minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

/** Ubicación del teléfono del chofer al confirmar la entrega. */
export class DriverDeliveryLocationDto extends SetPersonLocationDto {
  @ApiPropertyOptional({
    description:
      'Precisión informada por el GPS del teléfono, en metros. Por encima del límite (50 m por defecto) no se usa para ubicar al cliente.',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy_m?: number;
}

export class PersonLocationDto {
  @ApiProperty({ example: 5885 })
  person_id: number;

  @ApiPropertyOptional({ nullable: true, example: -27.4512345 })
  lat: number | null;

  @ApiPropertyOptional({ nullable: true, example: -58.9867654 })
  lng: number | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['ADMIN', 'MAPS_LINK', 'GOOGLE_GEOCODING', 'DRIVER_GPS'],
  })
  source: string | null;

  @ApiPropertyOptional({
    nullable: true,
    enum: ['EXACT', 'INTERPOLATED', 'APPROXIMATE'],
  })
  precision: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-11-25T10:15:00-03:00',
  })
  updated_at: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Link para navegar hasta el cliente con Google Maps',
  })
  navigation_url: string | null;
}

export const PENDING_LOCATION_REASONS = ['MISSING', 'APPROXIMATE'] as const;
export type PendingLocationReason = (typeof PENDING_LOCATION_REASONS)[number];

export class PendingLocationsQueryDto {
  @ApiPropertyOptional({
    enum: PENDING_LOCATION_REASONS,
    description:
      'MISSING: sin coordenadas. APPROXIMATE: con un punto aproximado (centro de calle o barrio). Sin filtro, ambos.',
  })
  @IsOptional()
  @IsIn(PENDING_LOCATION_REASONS)
  reason?: PendingLocationReason;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50, default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class PendingLocationItemDto extends PersonLocationDto {
  @ApiProperty({ example: 'Almacén Don Pepe' })
  name: string;

  @ApiPropertyOptional({ nullable: true, example: 'Av. Sarmiento 1234' })
  address: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Resistencia' })
  locality: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Centro' })
  zone: string | null;

  @ApiProperty({ enum: PENDING_LOCATION_REASONS })
  reason: PendingLocationReason;
}

export class LocationCoverageDto {
  @ApiProperty({ description: 'Clientes activos', example: 1452 })
  total: number;

  @ApiProperty({ description: 'Con punto exacto o interpolado', example: 1080 })
  located: number;

  @ApiProperty({ description: 'Con punto aproximado', example: 140 })
  approximate: number;

  @ApiProperty({ description: 'Sin coordenadas', example: 232 })
  missing: number;
}

export class PendingLocationsResponseDto {
  @ApiProperty({ type: LocationCoverageDto })
  coverage: LocationCoverageDto;

  @ApiProperty({ type: [PendingLocationItemDto] })
  data: PendingLocationItemDto[];

  @ApiProperty({ example: { page: 1, limit: 50, total: 372, total_pages: 8 } })
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface DriverLocationCaptureResult {
  applied: boolean;
  reason?:
    | 'NO_LOCATION'
    | 'LOW_ACCURACY'
    | 'OUT_OF_AREA'
    | 'NO_CUSTOMER'
    | 'ALREADY_LOCATED';
}
