import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustAllPlansPriceDto {
  @ApiPropertyOptional({
    description: 'Porcentaje de cambio a aplicar. Positivo para aumento, negativo para disminución. No usar si se especifica fixedAmount.',
    example: 10.5,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  percentage?: number;

  @ApiPropertyOptional({
    description: 'Monto fijo a sumar (o restar si es negativo) al precio actual. No usar si se especifica percentage.',
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  fixedAmount?: number;

  @ApiPropertyOptional({
    description: 'Razón o motivo del ajuste de precios (opcional).',
    example: 'Ajuste trimestral por inflación',
  })
  @IsOptional()
  @IsString()
  reason?: string;
} 