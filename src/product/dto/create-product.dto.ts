import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsBoolean, IsOptional, IsNumber, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 1, description: 'ID de la categoría' })
  @IsInt()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const num = parseInt(value, 10);
      return isNaN(num) ? value : num;
    }
    return value;
  })
  category_id: number;

  @ApiProperty({ example: 'Agua mineral', description: 'Descripción del producto' })
  @IsString()
  description: string;

  @ApiProperty({ example: 1.5, description: 'Volumen en litros', required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  @ValidateIf((o, v) => v !== null)
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }
    return value;
  })
  volume_liters?: number | null;

  @ApiProperty({ example: 50.0, description: 'Precio unitario' })
  @IsNumber()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }
    return value;
  })
  price: number;

  @ApiProperty({ example: true, description: 'Si es retornable o no' })
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
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