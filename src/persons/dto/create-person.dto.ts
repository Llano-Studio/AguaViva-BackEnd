import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePersonDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '3412345678' })
  @IsString() @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: 'Av. Siempre Viva 123' })
  @IsString() 
  @IsOptional()
  address?: string;

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

  @ApiProperty({ example: 'client' })
  @IsString() 
  @IsNotEmpty()
  type: string;
}
