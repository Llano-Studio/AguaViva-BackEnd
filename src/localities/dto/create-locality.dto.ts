import { IsString, IsNotEmpty, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateLocalityDto {
  @ApiProperty({
    example: 'RES',
    description:
      'Código único identificador de la localidad. Debe ser único en el sistema y se utiliza para referencias rápidas.',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'Resistencia',
    description:
      'Nombre completo de la localidad. Debe ser descriptivo y único dentro de la provincia.',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 1,
    description:
      'ID de la provincia a la que pertenece esta localidad. Debe existir en el sistema.',
    minimum: 1,
  })
  @IsInt()
  @Type(() => Number)
  provinceId: number;
}
