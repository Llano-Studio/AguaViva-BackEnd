import { IsInt, Min, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInventoryDto {
  @ApiProperty({
    example: 1,
    description: 'ID del producto'
  })
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({
    example: 1,
    description: 'ID del almacén'
  })
  @IsInt()
  @Min(1)
  warehouse_id: number;

  @ApiProperty({
    example: 100,
    description: 'Cantidad inicial de stock'
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiProperty({
    example: 'Inventario inicial del producto',
    description: 'Observaciones sobre la creación del inventario',
    required: false
  })
  @IsString()
  @IsOptional()
  remarks?: string;
} 