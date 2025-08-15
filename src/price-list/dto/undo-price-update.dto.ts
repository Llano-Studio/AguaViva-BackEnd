import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class UndoPriceUpdateDto {
  @ApiProperty({
    description: 'IDs de los registros de historial a deshacer',
    example: [1, 2, 3],
    type: [Number]
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @Type(() => Number)
  history_ids: number[];

  @ApiPropertyOptional({
    description: 'Razón para deshacer los cambios',
    example: 'Corrección de error en actualización masiva'
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Usuario que realiza la reversión',
    example: 'admin@example.com'
  })
  @IsOptional()
  @IsString()
  created_by?: string;
}