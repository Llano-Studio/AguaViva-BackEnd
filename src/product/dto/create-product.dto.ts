import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsBoolean, IsOptional, IsNumber, ValidateIf } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 1, description: 'ID de la categoría' })
  @IsInt()
  category_id: number;

  @ApiProperty({ example: 'Agua mineral', description: 'Descripción del producto' })
  @IsString()
  description: string;

  @ApiProperty({ example: 1.5, description: 'Volumen en litros', required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  @ValidateIf((o, v) => v !== null)
  volume_liters?: number | null;

  @ApiProperty({ example: 50.0, description: 'Precio unitario' })
  @IsNumber()
  price: number;

  @ApiProperty({ example: true, description: 'Si es retornable o no' })
  @IsBoolean()
  is_returnable: boolean;

  @ApiProperty({ example: 'SN123456', description: 'Número de serie', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null)
  serial_number?: string | null;

  @ApiProperty({ example: 'Producto importado', description: 'Notas adicionales', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null)
  notes?: string | null;

  @ApiProperty({
    description: 'Archivo de imagen del producto (opcional)',
    type: 'string',
    format: 'binary',
    required: false
  })
  @IsOptional()
  productImage?: any; 
}