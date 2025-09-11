import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleDto {
  @ApiProperty({
    example: 'TRK-001',
    description: 'Código único del vehículo',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'Camión Mercedes',
    description: 'Nombre del vehículo',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Camión de gran porte',
    description: 'Descripción',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
