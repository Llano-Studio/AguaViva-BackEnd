import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVehicleDto {
  @ApiProperty({
    example: 'TRK-001',
    description:
      'Código único identificador del vehículo. Debe ser único en el sistema y se utiliza para identificación rápida.',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'Camión Mercedes Benz Atego',
    description:
      'Nombre descriptivo del vehículo incluyendo marca y modelo para fácil identificación.',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example:
      'Camión de gran porte para entregas en zona norte. Capacidad de carga: 5 toneladas. Año 2020.',
    description:
      'Descripción detallada del vehículo incluyendo características técnicas, capacidad y uso específico.',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
