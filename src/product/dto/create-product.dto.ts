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
  @ApiProperty({ 
    example: 1, 
    description: 'ID de la categoría del producto',
    examples: {
      water: {
        value: 1,
        description: 'Categoría de agua embotellada'
      },
      dispensers: {
        value: 2,
        description: 'Categoría de dispensadores'
      },
      accessories: {
        value: 3,
        description: 'Categoría de accesorios'
      }
    }
  })
  @IsInt()
  @Transform(({ value }) => parseInteger(value))
  category_id: number;

  @ApiProperty({
    example: 'Botellón de agua purificada 20L',
    description: 'Descripción detallada del producto',
    examples: {
      water_20l: {
        value: 'Botellón de agua purificada 20L',
        description: 'Producto principal de agua'
      },
      water_500ml: {
        value: 'Agua mineral natural 500ml',
        description: 'Botella individual'
      },
      dispenser: {
        value: 'Dispensador de agua fría/caliente modelo Premium',
        description: 'Dispensador eléctrico'
      },
      accessories: {
        value: 'Bomba manual para botellón',
        description: 'Accesorio para dispensar agua'
      }
    }
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: 20.0,
    description: 'Volumen en litros (permite decimales como 0.5 para botellas pequeñas)',
    examples: {
      large_bottle: {
        value: 20.0,
        description: 'Botellón estándar de 20 litros'
      },
      medium_bottle: {
        value: 12.0,
        description: 'Botellón mediano de 12 litros'
      },
      small_bottle: {
        value: 0.5,
        description: 'Botella individual de 500ml'
      },
      dispenser: {
        value: null,
        description: 'No aplica para dispensadores'
      }
    },
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber(
    { maxDecimalPlaces: 2 },
    {
      message: 'volume_liters debe ser un número válido con máximo 2 decimales',
    },
  )
  @ValidateIf((o, v) => v !== null)
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return parseDecimal(value);
  })
  volume_liters?: number | null;

  @ApiProperty({ 
    example: 1200.0, 
    description: 'Precio unitario del producto en pesos',
    examples: {
      water_20l: {
        value: 1200.0,
        description: 'Precio botellón 20L'
      },
      water_500ml: {
        value: 150.0,
        description: 'Precio botella 500ml'
      },
      dispenser_premium: {
        value: 45000.0,
        description: 'Precio dispensador premium'
      },
      pump: {
        value: 800.0,
        description: 'Precio bomba manual'
      }
    }
  })
  @IsNumber()
  @Transform(({ value }) => parseDecimal(value))
  price: number;

  @ApiProperty({ 
    example: true, 
    description: 'Indica si el producto es retornable (envase se devuelve)',
    examples: {
      returnable: {
        value: true,
        description: 'Botellones retornables (se devuelve el envase)'
      },
      non_returnable: {
        value: false,
        description: 'Productos no retornables (dispensadores, accesorios)'
      }
    }
  })
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
    example: 'AV-BOT-20L-001',
    description: 'Número de serie o código interno del producto',
    examples: {
      water_bottle: {
        value: 'AV-BOT-20L-001',
        description: 'Código para botellón 20L'
      },
      dispenser: {
        value: 'AV-DISP-PREM-2024-001',
        description: 'Código para dispensador premium'
      },
      accessory: {
        value: 'AV-BOMB-MAN-001',
        description: 'Código para bomba manual'
      }
    },
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null)
  serial_number?: string | null;

  @ApiProperty({
    example: 'Producto de alta calidad con certificación sanitaria',
    description: 'Notas adicionales sobre el producto',
    examples: {
      water: {
        value: 'Agua purificada con proceso de ósmosis inversa - Certificación SENASA',
        description: 'Notas para productos de agua'
      },
      dispenser: {
        value: 'Dispensador con garantía de 2 años - Incluye instalación gratuita',
        description: 'Notas para dispensadores'
      },
      seasonal: {
        value: 'Producto de temporada - Stock limitado',
        description: 'Notas para productos estacionales'
      }
    },
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
