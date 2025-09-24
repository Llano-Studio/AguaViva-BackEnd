import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PersonType } from '../../common/constants/enums';

export class CreatePersonDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Juancho',
    description: 'Apodo o alias del cliente',
  })
  @IsString()
  @IsOptional()
  alias?: string;

  @ApiProperty({ example: '3412345678' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    example: '3412345679, 3412345680',
    description: 'Teléfonos adicionales separados por comas',
  })
  @IsString()
  @IsOptional()
  additionalPhones?: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '30123456789' })
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiProperty({ example: 2, description: 'ID de la localidad' })
  @IsInt()
  localityId: number;

  @ApiProperty({ example: 1, description: 'ID de la zona' })
  @IsInt()
  zoneId: number;

  @ApiPropertyOptional({ example: '2025-04-30', type: String })
  @IsDateString()
  @IsOptional()
  registrationDate?: string;

  @ApiProperty({
    example: 'INDIVIDUAL',
    enum: PersonType,
    description: 'Tipo de persona (INDIVIDUAL/PLAN)',
  })
  @IsEnum(PersonType)
  @IsNotEmpty()
  type: PersonType;

  @ApiPropertyOptional({
    example: false,
    description: 'Indica si el cliente posee bidones retornables propios',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    // Si ya es boolean, devolverlo tal como está
    if (typeof value === 'boolean') {
      return value;
    }
    
    // Si es string, convertir a boolean
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      return lowerValue === 'true' || lowerValue === '1';
    }
    
    // Si es number, convertir a boolean
    if (typeof value === 'number') {
      return value === 1;
    }
    
    // Para cualquier otro caso, devolver false por defecto en creación
    return false;
  })
  owns_returnable_containers?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Indica si la persona está activa',
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    // Si ya es boolean, devolverlo tal como está
    if (typeof value === 'boolean') {
      return value;
    }
    
    // Si es string, convertir a boolean
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      return lowerValue === 'true' || lowerValue === '1';
    }
    
    // Si es number, convertir a boolean
    if (typeof value === 'number') {
      return value === 1;
    }
    
    // Para cualquier otro caso, devolver true por defecto en creación
    return true;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    example: 'Cliente preferencial, entregar en horario de mañana',
    description: 'Notas adicionales sobre el cliente',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
