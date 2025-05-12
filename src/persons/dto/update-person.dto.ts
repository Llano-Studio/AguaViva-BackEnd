import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PersonType } from '../../common/constants/enums';

export class UpdatePersonDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsString() 
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '3412345678' })
  @IsString() 
  @IsOptional()
  phone?: string;

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
    description: 'Tipo de persona (INDIVIDUAL/PLAN)' 
  })
  @IsEnum(PersonType)
  @IsOptional()
  type?: PersonType;
}