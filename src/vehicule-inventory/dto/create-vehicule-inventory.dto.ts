import { IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleInventoryDto {
  @ApiProperty({
    example: 1,
    description: 'ID del vehículo',
  })
  @IsInt()
  @Min(1)
  vehicle_id: number;

  @ApiProperty({
    example: 5,
    description: 'ID del producto',
  })
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({
    example: 100,
    description: 'Cantidad cargada',
  })
  @IsInt()
  @Min(0)
  quantity_loaded: number;

  @ApiProperty({
    example: 20,
    description: 'Cantidad vacía',
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  quantity_empty?: number;
}
