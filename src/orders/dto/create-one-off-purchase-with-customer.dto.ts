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
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PersonType } from '../../common/constants/enums';

export class CreateOneOffPurchaseItemDto {
  @ApiProperty({
    description: 'ID del producto a comprar',
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
}

export class MinimalCustomerDataDto {
  @ApiProperty({
    description: 'Nombre completo del cliente',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Número de teléfono del cliente',
    example: '3412345678',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({
    description: 'Teléfonos adicionales separados por comas',
    example: '3412345679, 3412345680',
  })
  @IsString()
  @IsOptional()
  additionalPhones?: string;

  @ApiPropertyOptional({
    description: 'Apodo o alias del cliente',
    example: 'Juancho',
  })
  @IsString()
  @IsOptional()
  alias?: string;

  @ApiPropertyOptional({
    description: 'Dirección del cliente',
    example: 'Av. Siempre Viva 123',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: 'CUIT/CUIL/DNI del cliente',
    example: '30123456789',
  })
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiProperty({
    description: 'ID de la localidad del cliente',
    example: 2,
  })
  @IsInt()
  @IsNotEmpty()
  localityId: number;

  @ApiProperty({
    description: 'ID de la zona del cliente',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  zoneId: number;

  @ApiProperty({
    description: 'Tipo de persona (INDIVIDUAL/PLAN)',
    example: 'INDIVIDUAL',
    enum: PersonType,
  })
  @IsEnum(PersonType)
  @IsNotEmpty()
  type: PersonType;
}

export class CreateOneOffPurchaseWithCustomerDto {
  @ApiProperty({
    description: 'Datos mínimos del cliente a registrar',
    type: MinimalCustomerDataDto,
  })
  @ValidateNested()
  @Type(() => MinimalCustomerDataDto)
  @IsNotEmpty()
  customer: MinimalCustomerDataDto;

  @ApiProperty({
    description: 'Lista de productos a comprar',
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
    description:
      'ID de la lista de precios a usar (opcional, si no se especifica usa la lista estándar)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;

  @ApiPropertyOptional({
    description:
      'Dirección de entrega específica (opcional, si no se especifica usa la dirección del cliente)',
    example: 'Av. Principal 123, Apto 4B',
  })
  @IsOptional()
  @IsString()
  delivery_address?: string;

  @ApiPropertyOptional({
    description:
      'ID de la localidad para la entrega (opcional, si no se especifica usa la del cliente)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  locality_id?: number;

  @ApiPropertyOptional({
    description:
      'ID de la zona para la entrega (opcional, si no se especifica usa la del cliente)',
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

  @ApiProperty({
    description:
      'Indica si el pedido requiere entrega a domicilio (true) o el cliente pasa a retirar (false)',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  requires_delivery: boolean;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el pedido',
    example: 'Cliente prefiere entrega en horario de mañana',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
