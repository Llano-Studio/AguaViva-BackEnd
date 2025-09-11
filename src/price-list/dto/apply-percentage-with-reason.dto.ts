import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyPercentageWithReasonDto {
  @ApiProperty({
    description: 'Porcentaje de aumento o disminución a aplicar',
    example: 10,
    minimum: -100,
    maximum: 1000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(-100)
  @Max(1000)
  @Type(() => Number)
  percentage: number;

  @ApiPropertyOptional({
    description: 'Razón o motivo del cambio de precios',
    example: 'Ajuste por inflación',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Usuario que realiza el cambio',
    example: 'admin@example.com',
  })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
