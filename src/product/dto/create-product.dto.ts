import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  ValidateIf,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { parseInteger, parseDecimal } from '../../common/utils/parse-number';

export class CreateProductDto {
  @ApiProperty({ example: 1, description: 'ID de la categoría' })
  @IsInt()
  @Transform(({ value }) => parseInteger(value))
  category_id: number;

  @ApiProperty({
    example: 'Agua mineral',
    description: 'Descripción del producto',
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: 0.5,
    description: 'Volumen en litros (permite decimales como 0.5)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'volume_liters debe ser un número válido con máximo 2 decimales' })
  @ValidateIf((o, v) => v !== null)
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return parseDecimal(value);
  })
  volume_liters?: number | null;

  @ApiProperty({ example: 50.0, description: 'Precio unitario' })
  @IsNumber()
  @Transform(({ value }) => parseDecimal(value))
  price: number;

  @ApiProperty({ example: true, description: 'Si es retornable o no' })
  @IsBoolean()
  @Transform(({ value }) => {
    // Si ya es boolean, devolverlo tal como está
    if (typeof value === 'boolean') {
      return value;
    }
    
    // Si es string, convertir a boolean
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      if (lowerValue === 'true' || lowerValue === '1') {
        return true;
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return false;
      }
    }
    
    // Si es number, convertir a boolean
    if (typeof value === 'number') {
      return value === 1;
    }
    
    // Para cualquier otro caso, devolver false por defecto en creación
    return false;
  })
  is_returnable: boolean;

  @ApiProperty({
    example: 'SN123456',
    description: 'Número de serie',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null)
  serial_number?: string | null;

  @ApiProperty({
    example: 'Producto importado',
    description: 'Notas adicionales',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null)
  notes?: string | null;

  @ApiProperty({
    example: 100,
    description: `Stock inicial del producto en el almacén por defecto. 

**Comportamiento:**
- Si no se especifica o es 0: El producto se crea sin inventario inicial
- Si es mayor a 0: Se crea automáticamente inventario en el almacén por defecto (ID: 1)
- Se registra un movimiento de stock tipo "AJUSTE_POSITIVO" para trazabilidad

**Ejemplos:**
- total_stock: 0 → Producto sin stock inicial
- total_stock: 100 → Producto con 100 unidades en almacén principal
- total_stock: undefined → Mismo comportamiento que 0

**Nota para Frontend:** Campo opcional, enviar como number o omitir del payload`,
    required: false,
    minimum: 0,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    return parseInteger(value);
  })
  total_stock?: number;

  @ApiProperty({
    description: 'Archivo de imagen del producto (opcional)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  productImage?: any;
}
