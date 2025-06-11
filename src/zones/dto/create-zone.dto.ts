import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateZoneDto {
  @ApiProperty({ example: 'Z001' })
  @IsString() @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Zona Centro' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    example: 1,
    description: 'ID de la localidad a la que pertenece esta zona'
  })
  @IsInt()
  @Type(() => Number)
  localityId: number;
}
