import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOneOffPurchaseItemDto {
  @ApiProperty({
    description:
      'ID del producto a comprar. ⚠️ VALIDACIÓN: El producto debe existir en la base de datos.',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad del producto a comprar',
    minimum: 1,
    example: 2,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({
    description:
      'ID de la lista de precios específica para este producto (opcional). ⚠️ VALIDACIÓN: Si se proporciona, la lista de precios debe existir en la base de datos. Si no se especifica, se usa la lista de precios estándar.',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;
}

export class CreateOneOffPurchaseCustomerDto {
  @ApiPropertyOptional({
    description:
      'Nombre completo del cliente (solo requerido si es cliente nuevo)',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    description:
      'Número de teléfono del cliente (SIEMPRE REQUERIDO para verificar si existe)',
    example: '3412345678',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    description:
      'Teléfonos adicionales separados por comas (solo si es cliente nuevo)',
    example: '3412345679, 3412345680',
  })
  @IsOptional()
  @IsString()
  additionalPhones?: string;

  @ApiPropertyOptional({
    description: 'Alias o apodo del cliente (solo si es cliente nuevo)',
    example: 'Juan',
  })
  @IsOptional()
  @IsString()
  alias?: string;

  @ApiPropertyOptional({
    description: 'Dirección del cliente (solo si es cliente nuevo)',
    example: 'Av. Principal 123',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'RUC o documento de identidad (solo si es cliente nuevo)',
    example: '12345678-9',
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    description: 'ID de la localidad del cliente (solo si es cliente nuevo)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  localityId?: number;

  @ApiPropertyOptional({
    description: 'ID de la zona del cliente (solo si es cliente nuevo)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  zoneId?: number;

  @ApiPropertyOptional({
    description: 'Tipo de cliente (solo si es cliente nuevo)',
    example: 'INDIVIDUAL',
    enum: ['INDIVIDUAL', 'CORPORATE'],
  })
  @IsOptional()
  @IsEnum(['INDIVIDUAL', 'CORPORATE'])
  type?: string = 'INDIVIDUAL';
}

export class CreateOneOffPurchaseDto {
  @ApiProperty({
    description:
      'Datos del cliente (SIEMPRE REQUERIDO). El sistema verificará si existe por teléfono.',
    type: CreateOneOffPurchaseCustomerDto,
  })
  @ValidateNested()
  @Type(() => CreateOneOffPurchaseCustomerDto)
  customer: CreateOneOffPurchaseCustomerDto;

  @ApiProperty({
    description: `Lista de productos a comprar.
    
⚠️ LIMITACIÓN ACTUAL: Solo se procesa el PRIMER producto de la lista.
La base de datos actual solo soporta UN producto por compra única.
Para múltiples productos, debe crear varias compras separadas.

Recomendación: Enviar un solo item en el array hasta que se implemente soporte completo para múltiples productos.`,
    type: [CreateOneOffPurchaseItemDto],
    example: [{ product_id: 1, quantity: 2 }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOneOffPurchaseItemDto)
  @IsNotEmpty()
  items: CreateOneOffPurchaseItemDto[];

  @ApiProperty({
    description: 'ID del canal de venta',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  sale_channel_id: number;

  @ApiPropertyOptional({
    description: 'Si requiere entrega a domicilio',
    example: true,
  })
  @IsOptional()
  requires_delivery?: boolean = false;

  @ApiPropertyOptional({
    description: 'Dirección de entrega específica (opcional)',
    example: 'Av. Principal 123, Apto 4B',
  })
  @IsOptional()
  @IsString()
  delivery_address?: string;

  @ApiPropertyOptional({
    description: 'ID de la localidad para la entrega',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  locality_id?: number;

  @ApiPropertyOptional({
    description: 'ID de la zona para la entrega',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  zone_id?: number;

  @ApiPropertyOptional({
    description:
      'Fecha de la compra en formato ISO (si no se especifica, se usa la fecha actual)',
    example: '2024-03-20T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @ApiPropertyOptional({
    description:
      'Fecha programada de entrega del pedido en formato ISO (opcional). NOTA: No requerido si requires_delivery=false',
    example: '2024-03-21T14:00:00Z',
  })
  @IsOptional()
  @ValidateIf(
    (object) =>
      object.scheduled_delivery_date !== '' &&
      object.scheduled_delivery_date !== null &&
      object.scheduled_delivery_date !== undefined,
  )
  @IsDateString()
  scheduled_delivery_date?: string;

  @ApiPropertyOptional({
    description:
      'Rango de horario de entrega (opcional). NOTA: No requerido si requires_delivery=false',
    example: '9:00 AM - 12:00 PM',
  })
  @IsOptional()
  @ValidateIf(
    (object) =>
      object.delivery_time !== '' &&
      object.delivery_time !== null &&
      object.delivery_time !== undefined,
  )
  @IsString()
  delivery_time?: string;

  @ApiPropertyOptional({
    description:
      'Monto total de la compra (opcional, se calcula automáticamente si no se proporciona)',
    example: '1500.00',
  })
  @IsOptional()
  @IsString()
  total_amount?: string;

  @ApiPropertyOptional({
    description:
      '⚠️ DEPRECADO: Este campo se ignora al crear órdenes oneOff. Las órdenes siempre se crean con paid_amount = 0. Los pagos deben registrarse por separado a través del sistema de transacciones de pago.',
    example: '0.00',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  paid_amount?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre la compra (opcional)',
    example: 'Cliente prefiere entrega por la mañana',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Estado de la orden (opcional). Si no se especifica, se determina automáticamente: RETIRADO si requires_delivery=false, PENDING si requires_delivery=true',
    example: 'PENDING',
    enum: ['PENDING', 'RETIRADO', 'DELIVERED', 'CANCELLED'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  // total_amount se calcula automáticamente en el backend basado en los items y la lista de precios seleccionada.
}
