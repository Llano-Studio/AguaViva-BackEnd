import { IsInt, IsNotEmpty, IsOptional, IsString, Min, IsDateString, IsArray, ValidateNested, ValidateIf, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PersonType } from '../../common/constants/enums';

export class CreateOneOffPurchaseItemDto {
  @ApiProperty({
    description: 'ID del producto a comprar',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad del producto a comprar',
    minimum: 1,
    example: 2
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}

export class CreateOneOffPurchaseCustomerDto {
  @ApiProperty({
    description: 'Nombre completo del cliente',
    example: 'Juan Pérez'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Número de teléfono del cliente (se usa para buscar clientes existentes)',
    example: '3412345678'
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

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

  @ApiProperty({
    description: 'ID de la localidad del cliente',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  localityId: number;

  @ApiProperty({
    description: 'ID de la zona del cliente',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  zoneId: number;

  @ApiPropertyOptional({
    description: 'Tipo de cliente',
    example: 'INDIVIDUAL',
    enum: ['INDIVIDUAL', 'CORPORATE']
  })
  @IsOptional()
  @IsEnum(['INDIVIDUAL', 'CORPORATE'])
  type?: string = 'INDIVIDUAL';
}

export class CreateOneOffPurchaseDto {
  @ApiPropertyOptional({
    description: 'ID de la persona existente (opcional si se proporciona customer)',
    example: 1
  })
  @ValidateIf(o => !o.customer)
  @IsInt()
  @IsNotEmpty()
  person_id?: number;

  @ApiPropertyOptional({
    description: 'Datos del cliente a registrar o buscar (opcional si se proporciona person_id)',
    type: CreateOneOffPurchaseCustomerDto
  })
  @ValidateIf(o => !o.person_id)
  @ValidateNested()
  @Type(() => CreateOneOffPurchaseCustomerDto)
  customer?: CreateOneOffPurchaseCustomerDto;

  @ApiProperty({
    description: `Lista de productos a comprar.
    
⚠️ LIMITACIÓN ACTUAL: Solo se procesa el PRIMER producto de la lista.
La base de datos actual solo soporta UN producto por compra única.
Para múltiples productos, debe crear varias compras separadas.

Recomendación: Enviar un solo item en el array hasta que se implemente soporte completo para múltiples productos.`,
    type: [CreateOneOffPurchaseItemDto],
    example: [{ product_id: 1, quantity: 2 }]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOneOffPurchaseItemDto)
  @IsNotEmpty()
  items: CreateOneOffPurchaseItemDto[];

  @ApiProperty({
    description: 'ID del canal de venta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  sale_channel_id: number;

  @ApiPropertyOptional({
    description: 'Si requiere entrega a domicilio',
    example: true
  })
  @IsOptional()
  requires_delivery?: boolean = false;

  @ApiPropertyOptional({
    description: 'ID de la lista de precios a usar (opcional, si no se especifica usa la lista estándar)',
    example: 1
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;

  @ApiPropertyOptional({
    description: 'Dirección de entrega específica (opcional)',
    example: 'Av. Principal 123, Apto 4B'
  })
  @IsOptional()
  @IsString()
  delivery_address?: string;

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
    description: 'Fecha de la compra en formato ISO (si no se especifica, se usa la fecha actual)',
    example: '2024-03-20T10:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  // total_amount se calcula automáticamente en el backend basado en los items y la lista de precios seleccionada.
} 