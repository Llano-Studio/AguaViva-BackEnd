import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsString, IsInt, IsArray, ValidateNested, IsNotEmpty, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PersonType } from '../../common/constants/enums';

export class UpdateOneOffPurchaseCustomerDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del cliente',
    example: 'Juan Pérez'
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Número de teléfono del cliente',
    example: '3412345678'
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Teléfonos adicionales separados por comas',
    example: '3412345679, 3412345680'
  })
  @IsOptional()
  @IsString()
  additionalPhones?: string;

  @ApiPropertyOptional({
    description: 'Alias o apodo del cliente',
    example: 'Juan'
  })
  @IsOptional()
  @IsString()
  alias?: string;

  @ApiPropertyOptional({
    description: 'Dirección del cliente',
    example: 'Av. Principal 123'
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'RUC o documento de identidad',
    example: '12345678-9'
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    description: 'ID de la localidad del cliente',
    example: 1
  })
  @IsOptional()
  @IsInt()
  localityId?: number;

  @ApiPropertyOptional({
    description: 'ID de la zona del cliente',
    example: 1
  })
  @IsOptional()
  @IsInt()
  zoneId?: number;

  @ApiPropertyOptional({
    description: 'Tipo de cliente',
    example: 'INDIVIDUAL',
    enum: ['INDIVIDUAL', 'CORPORATE']
  })
  @IsOptional()
  @IsEnum(['INDIVIDUAL', 'CORPORATE'])
  type?: string;
}

export class UpdateOneOffPurchaseItemDto {
  @ApiProperty({
    description: 'ID del producto',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad del producto',
    minimum: 1,
    example: 2
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({
    description: 'ID de la lista de precios (opcional, usa la lista por defecto si no se especifica)',
    example: 1
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;
}

export class UpdateOneOffPurchaseDto {
    @ApiPropertyOptional({
        description: 'Datos del cliente a actualizar',
        type: UpdateOneOffPurchaseCustomerDto
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => UpdateOneOffPurchaseCustomerDto)
    customer?: UpdateOneOffPurchaseCustomerDto;

    @ApiPropertyOptional({
        description: 'Lista de productos a actualizar. Estructura simplificada con product_id y quantity.',
        type: [UpdateOneOffPurchaseItemDto],
        example: [{ product_id: 1, quantity: 2 }]
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateOneOffPurchaseItemDto)
    items?: UpdateOneOffPurchaseItemDto[];

    @ApiPropertyOptional({
        description: 'ID del canal de venta',
        example: 1
    })
    @IsOptional()
    @IsInt()
    sale_channel_id?: number;

    @ApiPropertyOptional({
        description: 'ID de la localidad para la entrega',
        example: 1
    })
    @IsOptional()
    @IsInt()
    locality_id?: number;

    @ApiPropertyOptional({
        description: 'ID de la zona para la entrega',
        example: 1
    })
    @IsOptional()
    @IsInt()
    zone_id?: number;

    @ApiPropertyOptional({
        description: 'Dirección de entrega específica',
        example: 'Av. Principal 123, Apto 4B'
    })
    @IsOptional()
    @IsString()
    delivery_address?: string;

    @ApiPropertyOptional({
        description: 'Fecha de la compra en formato ISO',
        example: '2024-03-20T10:00:00Z'
    })
    @IsOptional()
    @IsDateString()
    purchase_date?: string;

    @ApiPropertyOptional({
        description: 'Fecha programada de entrega en formato ISO',
        example: '2024-03-21T14:00:00Z'
    })
    @IsOptional()
    @IsDateString()
    scheduled_delivery_date?: string;

    @ApiPropertyOptional({
        description: 'Rango de horario de entrega',
        example: '9:00 AM - 12:00 PM'
    })
    @IsOptional()
    @IsString()
    delivery_time?: string;

    @ApiPropertyOptional({
        description: 'Monto pagado por el cliente',
        example: '1500.00'
    })
    @IsOptional()
    @IsString()
    paid_amount?: string;

    @ApiPropertyOptional({
        description: 'Notas adicionales sobre la compra',
        example: 'Cliente prefiere entrega por la mañana'
    })
    @IsOptional()
    @IsString()
    notes?: string;

    @ApiPropertyOptional({
        description: 'Estado de la orden (PENDING, DELIVERED, CANCELLED)',
        example: 'DELIVERED',
        enum: ['PENDING', 'DELIVERED', 'CANCELLED']
    })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional({
        description: 'Si requiere entrega a domicilio',
        example: true
    })
    @IsOptional()
    requires_delivery?: boolean;

    @ApiPropertyOptional({
        description: 'Monto total de la compra',
        example: '1500.00'
    })
    @IsOptional()
    @IsString()
    total_amount?: string;
}