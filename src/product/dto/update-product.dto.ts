import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, IsBoolean, IsOptional, IsNumber, ValidateIf, Min } from 'class-validator';
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
    example: 150, 
    description: `Nuevo stock total deseado del producto en el almacén por defecto.

**⚠️ IMPORTANTE - Gestión Automática de Stock:**

**Comportamiento del Sistema:**
1. **Calcula diferencia:** nuevo_stock - stock_actual
2. **Genera movimiento automático:** 
   - Si diferencia > 0: Movimiento "AJUSTE_POSITIVO" (suma stock)
   - Si diferencia < 0: Movimiento "AJUSTE_NEGATIVO" (resta stock)
   - Si diferencia = 0: No genera movimiento

**Casos de Uso:**
- Stock actual: 100, total_stock: 150 → Se SUMA 50 unidades
- Stock actual: 100, total_stock: 80 → Se RESTA 20 unidades  
- Stock actual: 0, total_stock: 50 → Se crea inventario inicial con 50 unidades
- total_stock no enviado → No modifica el stock actual

**Respuesta del Sistema:**
- La respuesta incluirá el stock final calculado en el campo \`total_stock\`
- Se registra movimiento de trazabilidad automáticamente

**Para Frontend:**
- Mostrar stock actual antes de permitir modificación
- Validar que el usuario confirme el cambio de stock
- Campo opcional: omitir del payload si no se quiere modificar stock`,
    minimum: 0,
    type: 'integer'
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    return parseInteger(value);
  })
  total_stock?: number;

  @ApiPropertyOptional({
    description: 'Archivo de imagen del producto (opcional)',
    type: 'string',
    format: 'binary'
  })
  @IsOptional()
  productImage?: any; // El tipo real será Express.Multer.File, manejado por el controlador
}
