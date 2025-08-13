import { IsString, IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateLocalityDto {
  @ApiProperty({ 
    example: 'RES',
    description: 'Código único de la localidad'
  })
  @IsString() 
  @IsNotEmpty()
  code: string;

  @ApiProperty({ 
    example: 'Resistencia',
    description: 'Nombre de la localidad'
  })
  @IsString() 
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    example: 1,
    description: 'ID de la provincia a la que pertenece esta localidad'
  })
  @IsInt()
  @Type(() => Number)
  provinceId: number;
}