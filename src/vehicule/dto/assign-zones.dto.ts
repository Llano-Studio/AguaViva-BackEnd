import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignZonesToVehicleDto {
  @ApiProperty({
    description: 'IDs de las zonas a asignar al vehículo',
    example: [1, 2, 3],
    type: [Number]
  })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  zoneIds: number[];

  @ApiProperty({
    description: 'Notas sobre la asignación de zonas',
    example: 'Asignación para ruta matutina',
    required: false
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Estado activo de la asignación',
    example: true,
    default: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class VehicleZoneResponseDto {
  @ApiProperty({ description: 'ID de la relación vehículo-zona' })
  vehicle_zone_id: number;

  @ApiProperty({ description: 'ID del vehículo' })
  vehicle_id: number;

  @ApiProperty({ description: 'ID de la zona' })
  zone_id: number;

  @ApiProperty({ description: 'Fecha de asignación' })
  assigned_at: string;

  @ApiProperty({ description: 'Estado activo' })
  is_active: boolean;

  @ApiProperty({ description: 'Notas de la asignación', required: false })
  notes?: string;

  @ApiProperty({ description: 'Información de la zona' })
  zone: {
    zone_id: number;
    code: string;
    name: string;
    locality: {
      locality_id: number;
      code: string;
      name: string;
      province: {
        province_id: number;
        code: string;
        name: string;
        country: {
          country_id: number;
          code: string;
          name: string;
        };
      };
    };
  };
} 