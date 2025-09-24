import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PersonType } from '../../common/constants/enums';

export class UpdatePersonDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'Juancho',
    description: 'Apodo o alias del cliente',
  })
  @IsString()
  @IsOptional()
  alias?: string;

  @ApiPropertyOptional({ example: '3412345678' })
  @IsString()
  @IsOptional()
  phone?: string;

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

  @ApiPropertyOptional({ example: 2, description: 'ID de la localidad' })
  @IsInt()
  @IsOptional()
  localityId?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID de la zona' })
  @IsInt()
  @IsOptional()
  zoneId?: number;

  @ApiPropertyOptional({ example: '2025-04-30', type: String })
  @IsDateString()
  @IsOptional()
  registrationDate?: string;

  @ApiPropertyOptional({
    example: 'INDIVIDUAL',
    enum: PersonType,
    description: 'Tipo de persona (INDIVIDUAL/PLAN)',
  })
  @IsEnum(PersonType)
  @IsOptional()
  type?: PersonType;

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
      if (lowerValue === 'true' || lowerValue === '1') {
        return true;
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return false;
      }
    }
    
    // Si es number, convertir a boolean
    if (typeof value === 'number') {
      return value === 1;
    }

    return undefined;
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
      if (lowerValue === 'true' || lowerValue === '1') {
        return true;
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return false;
      }
    }
    
    // Si es number, convertir a boolean
    if (typeof value === 'number') {
      return value === 1;
    }
    
    // Para cualquier otro caso (null, undefined, etc.), devolver undefined
    // para que el campo sea opcional y no se actualice si no se envía
    return undefined;
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
