import { IsString, IsNotEmpty, } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateZoneDto {
  @ApiProperty({ example: 'Z001' })
  @IsString() @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Zona Norte' })
  @IsString() @IsNotEmpty()
  name: string;

}
