import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WaypointDto {
  @ApiProperty({
    description:
      'Latitud del punto geográfico en coordenadas decimales (WGS84)',
    example: -34.603722,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  lat: number;

  @ApiProperty({
    description:
      'Longitud del punto geográfico en coordenadas decimales (WGS84)',
    example: -58.381592,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({
    description:
      'ID del detalle de hoja de ruta asociado a este punto de entrega',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @IsOptional()
  route_sheet_detail_id?: number;

  @ApiPropertyOptional({
    description: 'Dirección legible y formateada del punto de entrega',
    example: 'Av. Rivadavia 1234, CABA, Buenos Aires',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  address?: string;
}

export class CreateRouteOptimizationDto {
  @ApiProperty({
    description:
      'ID de la hoja de ruta que se desea optimizar para mejorar eficiencia de entregas',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @IsNotEmpty()
  route_sheet_id: number;

  @ApiPropertyOptional({
    description:
      'Punto de inicio personalizado de la ruta. Si no se especifica, se utilizará la ubicación del almacén principal como punto de partida.',
    type: WaypointDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => WaypointDto)
  @IsOptional()
  start_point?: WaypointDto;

  @ApiPropertyOptional({
    description:
      'Punto final personalizado de la ruta. Si no se especifica, se utilizará el mismo punto de inicio para crear una ruta circular.',
    type: WaypointDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => WaypointDto)
  @IsOptional()
  end_point?: WaypointDto;

  @ApiPropertyOptional({
    description:
      'Criterio de optimización: true para optimizar por tiempo de viaje, false para optimizar por distancia total',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  optimize_by_time?: boolean = true;

  @ApiPropertyOptional({
    description:
      'Incluir condiciones de tráfico en tiempo real para cálculos más precisos de tiempo de viaje',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  consider_traffic?: boolean = true;
}

export class RouteOptimizationResponseDto {
  @ApiProperty({
    description: 'ID de la optimización',
    example: 1,
  })
  optimization_id: number;

  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 1,
  })
  route_sheet_id: number;

  @ApiProperty({
    description: 'Duración total estimada en minutos',
    example: 120,
  })
  estimated_duration: number;

  @ApiProperty({
    description: 'Distancia total en kilómetros',
    example: 45.5,
  })
  estimated_distance: number;

  @ApiProperty({
    description: 'Estado de la optimización',
    example: 'COMPLETED',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'],
  })
  optimization_status: string;

  @ApiProperty({
    description: 'Puntos de la ruta optimizada',
    type: [WaypointDto],
  })
  waypoints: WaypointDto[];

  @ApiPropertyOptional({
    description: 'Fecha de creación',
    example: '2023-08-15T14:30:00Z',
  })
  created_at?: string;

  constructor(partial: Partial<RouteOptimizationResponseDto>) {
    Object.assign(this, partial);
  }
}
