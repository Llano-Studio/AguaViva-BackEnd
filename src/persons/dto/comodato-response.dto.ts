import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComodatoStatus } from '@prisma/client';

export class ComodatoResponseDto {
  @ApiProperty({ example: 1, description: 'ID único del comodato' })
  comodato_id: number;

  @ApiProperty({ example: 1, description: 'ID de la persona/cliente' })
  person_id: number;

  @ApiProperty({ example: 1, description: 'ID del producto' })
  product_id: number;

  @ApiProperty({
    example: 2,
    description: 'Cantidad actual de productos en comodato',
  })
  quantity: number;

  @ApiPropertyOptional({
    example: 7,
    description: 'Cantidad máxima permitida según la suscripción',
  })
  max_quantity?: number;

  @ApiProperty({
    example: '2025-01-15T00:00:00.000Z',
    description: 'Fecha de entrega del comodato',
  })
  delivery_date: Date;

  @ApiPropertyOptional({
    example: '2025-12-15T00:00:00.000Z',
    description: 'Fecha esperada de devolución',
  })
  expected_return_date?: Date;

  @ApiPropertyOptional({
    example: '2025-01-20T00:00:00.000Z',
    description: 'Fecha real de devolución',
  })
  actual_return_date?: Date;

  @ApiProperty({
    example: 'ACTIVE',
    enum: ComodatoStatus,
    description: 'Estado del comodato',
  })
  status: ComodatoStatus;

  @ApiPropertyOptional({
    example: 'Comodato de bidones para cliente nuevo',
    description: 'Notas adicionales',
  })
  notes?: string;

  @ApiPropertyOptional({
    example: 5000.0,
    description: 'Monto del depósito en garantía',
  })
  deposit_amount?: number;

  @ApiPropertyOptional({
    example: 500.0,
    description: 'Cuota mensual del comodato',
  })
  monthly_fee?: number;

  @ApiPropertyOptional({
    example: 'Dispensador de agua fría/caliente',
    description: 'Descripción del artículo en comodato',
  })
  article_description?: string;

  @ApiPropertyOptional({
    example: 'Samsung',
    description: 'Marca del producto en comodato',
  })
  brand?: string;

  @ApiPropertyOptional({
    example: 'WD-500X',
    description: 'Modelo del producto en comodato',
  })
  model?: string;

  @ApiPropertyOptional({
    example: '/uploads/contracts/comodato_123_contract.jpg',
    description: 'Ruta de la imagen del contrato',
  })
  contract_image_path?: string;

  @ApiProperty({
    example: true,
    description: 'Indica si el comodato está activo',
  })
  is_active: boolean;

  @ApiProperty({
    example: '2025-01-10T10:30:00.000Z',
    description: 'Fecha de creación del registro',
  })
  created_at: Date;

  @ApiProperty({
    example: '2025-01-15T14:20:00.000Z',
    description: 'Fecha de última actualización',
  })
  updated_at: Date;

  // Información relacionada del cliente
  @ApiPropertyOptional({
    description: 'Información del cliente',
    example: {
      person_id: 1,
      name: 'Juan Pérez',
      phone: '3412345678',
      address: 'Av. Siempre Viva 123',
    },
  })
  person?: {
    person_id: number;
    name: string;
    phone: string;
    address?: string;
    zone?: {
      zone_id: number;
      name: string;
    };
  };

  // Información relacionada del producto
  @ApiPropertyOptional({
    description: 'Información del producto',
    example: {
      product_id: 1,
      name: 'Bidón 20L',
      description: 'Bidón de agua de 20 litros',
    },
  })
  product?: {
    product_id: number;
    name: string;
    description?: string;
  };

  @ApiPropertyOptional({
    description: 'Información de la suscripción asociada',
    example: {
      subscription_id: 1,
      name: 'Plan Básico',
    },
  })
  subscription?: {
    subscription_id: number;
    name: string;
  };
}
