import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsEnum, IsOptional } from 'class-validator';

export enum RoundingStrategy {
  ROUND = 'round', // Redondear al entero más cercano
  CEIL = 'ceil',   // Redondear hacia arriba
  FLOOR = 'floor', // Redondear hacia abajo
}

export class AdjustPlanProductQuantitiesDto {
  @ApiProperty({
    example: 10,
    description: 'Porcentaje de cambio a aplicar a las cantidades de los productos. Positivo para aumentar, negativo para disminuir (ej: 10 para +10%, -5 para -5%).',
  })
  @IsNumber()
  percentage_change: number;

  @ApiPropertyOptional({
    example: RoundingStrategy.ROUND,
    description: 'Estrategia de redondeo para las nuevas cantidades (opcional, por defecto "round").',
    enum: RoundingStrategy,
  })
  @IsOptional()
  @IsEnum(RoundingStrategy)
  rounding_strategy?: RoundingStrategy = RoundingStrategy.ROUND;
} 