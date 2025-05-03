import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 1, description: 'ID de la categoría' })
  @IsInt()
  category_id: number;

  @ApiProperty({ example: 'Agua mineral', description: 'Descripción del producto' })
  @IsString()
  description: string;

  @ApiProperty({ example: 1.5, description: 'Volumen en litros', required: false })
  @IsOptional()
  @IsNumber()
  volume_liters?: number;

  @ApiProperty({ example: 50.0, description: 'Precio unitario' })
  @IsNumber()
  price: number;

  @ApiProperty({ example: true, description: 'Si es retornable o no' })
  @IsBoolean()
  is_returnable: boolean;

  @ApiProperty({ example: 'SN123456', description: 'Número de serie', required: false })
  @IsOptional()
  @IsString()
  serial_number?: string;

  @ApiProperty({ example: 'Producto importado', description: 'Notas adicionales', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}