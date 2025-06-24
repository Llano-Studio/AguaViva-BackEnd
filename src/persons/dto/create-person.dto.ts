import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNotEmpty,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PersonType } from '../../common/constants/enums';

export class CreatePersonDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Juancho', description: 'Apodo o alias del cliente' })
  @IsString()
  @IsOptional()
  alias?: string;

  @ApiProperty({ example: '3412345678' })
  @IsString() @IsNotEmpty()
  phone: string;

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
    description: 'Tipo de persona (INDIVIDUAL/PLAN)' 
  })
  @IsEnum(PersonType)
  @IsNotEmpty()
  type: PersonType;
}
