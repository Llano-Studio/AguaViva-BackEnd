import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignVehiclesToUserDto {
  @ApiProperty({
    description: 'IDs de los vehículos a asignar al usuario',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  vehicleIds: number[];

  @ApiProperty({
    description: 'Notas sobre la asignación de vehículos',
    example: 'Asignación para conductor de turno matutino',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Estado activo de la asignación',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UserVehicleResponseDto {
  @ApiProperty({ description: 'ID de la relación usuario-vehículo' })
  user_vehicle_id: number;

  @ApiProperty({ description: 'ID del usuario' })
  user_id: number;

  @ApiProperty({ description: 'ID del vehículo' })
  vehicle_id: number;

  @ApiProperty({ description: 'Fecha de asignación' })
  assigned_at: string;

  @ApiProperty({ description: 'Estado activo' })
  is_active: boolean;

  @ApiProperty({ description: 'Notas de la asignación', required: false })
  notes?: string;

  @ApiProperty({ description: 'Información del vehículo' })
  vehicle: {
    vehicle_id: number;
    code: string;
    name: string;
    description?: string;
  };

  @ApiProperty({ description: 'Información del usuario' })
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}
