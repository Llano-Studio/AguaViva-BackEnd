import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsBoolean, IsNumber, IsObject, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class WaypointDto {
  @ApiProperty({
    description: 'Latitud del punto',
    example: -34.603722
  })
  @IsNumber()
  lat: number;

  @ApiProperty({
    description: 'Longitud del punto',
    example: -58.381592
  })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({
    description: 'ID del detalle de hoja de ruta relacionado',
    example: 1
  })
  @IsInt()
  @IsOptional()
  route_sheet_detail_id?: number;

  @ApiPropertyOptional({
    description: 'Dirección legible',
    example: 'Av. Rivadavia 1234, CABA'
  })
  @IsString()
  @IsOptional()
  address?: string;
}

export class CreateRouteOptimizationDto {
  @ApiProperty({
    description: 'ID de la hoja de ruta a optimizar',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  route_sheet_id: number;

  @ApiPropertyOptional({
    description: 'Punto de inicio de la ruta (por defecto será la ubicación del almacén)',
    type: WaypointDto
  })
  @IsObject()
  @ValidateNested()
  @Type(() => WaypointDto)
  @IsOptional()
  start_point?: WaypointDto;

  @ApiPropertyOptional({
    description: 'Punto final de la ruta (por defecto será el mismo que el punto de inicio)',
    type: WaypointDto
  })
  @IsObject()
  @ValidateNested()
  @Type(() => WaypointDto)
  @IsOptional()
  end_point?: WaypointDto;

  @ApiPropertyOptional({
    description: 'Optimizar por tiempo (true) o distancia (false)',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  optimize_by_time?: boolean = true;

  @ApiPropertyOptional({
    description: 'Considerar el tráfico actual',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  consider_traffic?: boolean = true;
}

export class RouteOptimizationResponseDto {
  @ApiProperty({
    description: 'ID de la optimización',
    example: 1
  })
  optimization_id: number;

  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 1
  })
  route_sheet_id: number;

  @ApiProperty({
    description: 'Duración total estimada en minutos',
    example: 120
  })
  estimated_duration: number;

  @ApiProperty({
    description: 'Distancia total en kilómetros',
    example: 45.5
  })
  estimated_distance: number;

  @ApiProperty({
    description: 'Estado de la optimización',
    example: 'COMPLETED',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']
  })
  optimization_status: string;

  @ApiProperty({
    description: 'Puntos de la ruta optimizada',
    type: [WaypointDto]
  })
  waypoints: WaypointDto[];

  @ApiPropertyOptional({
    description: 'Fecha de creación',
    example: '2023-08-15T14:30:00Z'
  })
  created_at?: string;

  constructor(partial: Partial<RouteOptimizationResponseDto>) {
    Object.assign(this, partial);
  }
} 