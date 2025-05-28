import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsNumber, Min, ValidateNested, IsOptional, IsEnum } from 'class-validator';

class ProductAdjustmentItemDto {
  @ApiProperty({ description: 'ID del producto a ajustar', example: 101 })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({ description: 'Nueva cantidad para el producto. Si es 0, el producto se eliminará del plan.', example: 5, minimum: 0 })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  quantity: number;
}

export enum RoundingStrategy {
  ROUND = 'round', // Redondear al entero más cercano
  CEIL = 'ceil',   // Redondear hacia arriba
  FLOOR = 'floor', // Redondear hacia abajo
}

export class AdjustPlanProductQuantitiesDto {
  @ApiProperty({
    description: 'Lista de productos y sus nuevas cantidades para el plan. Si un producto existente en el plan no se incluye aquí, se mantendrá sin cambios. Si un producto se incluye con cantidad 0, se eliminará del plan. Si un producto nuevo se incluye con cantidad > 0, se agregará.',
    type: [ProductAdjustmentItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAdjustmentItemDto)
  products: ProductAdjustmentItemDto[];

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