import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsBoolean, IsOptional, IsNumber, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { parseInteger, parseDecimal } from '../../common/utils/parse-number';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 1, description: 'ID de la categoría' })
  @IsOptional()
  @IsInt()
  @Transform(({ value }) => parseInteger(value))
  category_id?: number;

  @ApiPropertyOptional({ example: 'Agua mineral', description: 'Descripción del producto' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1.5, description: 'Volumen en litros', nullable: true })
  @IsOptional()
  @IsNumber()
  @ValidateIf((o, v) => v !== null)
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return parseDecimal(value);
  })
  volume_liters?: number | null;

  @ApiPropertyOptional({ example: 50.0, description: 'Precio unitario' })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseDecimal(value))
  price?: number;

  @ApiPropertyOptional({ example: true, description: 'Si es retornable o no' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  is_returnable?: boolean;

  @ApiPropertyOptional({ example: 'SN123456', description: 'Número de serie', nullable: true })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null)
  serial_number?: string | null;

  @ApiPropertyOptional({ example: 'Producto importado', description: 'Notas adicionales', nullable: true })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null)
  notes?: string | null;

  @ApiPropertyOptional({
    description: 'Archivo de imagen del producto (opcional)',
    type: 'string',
    format: 'binary'
  })
  @IsOptional()
  productImage?: any; // El tipo real será Express.Multer.File, manejado por el controlador
}
