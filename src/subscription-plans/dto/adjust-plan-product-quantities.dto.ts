import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, Min, ValidateNested } from 'class-validator';

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

export class AdjustPlanProductQuantitiesDto {
  @ApiProperty({
    description: 'Lista de productos y sus nuevas cantidades para el plan. Si un producto existente en el plan no se incluye aquí, se mantendrá sin cambios. Si un producto se incluye con cantidad 0, se eliminará del plan. Si un producto nuevo se incluye con cantidad > 0, se agregará.',
    type: [ProductAdjustmentItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAdjustmentItemDto)
  products: ProductAdjustmentItemDto[];
} 