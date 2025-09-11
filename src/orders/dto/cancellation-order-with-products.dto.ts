import { CancellationOrderStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CancellationOrderProductDto {
  @ApiProperty({
    description: 'ID del producto',
    example: 1,
  })
  product_id: number;

  @ApiProperty({
    description: 'Nombre del producto',
    example: 'Agua Purificada 20L',
  })
  name: string;

  @ApiProperty({
    description: 'Descripción del producto',
    example: 'Botellón de agua purificada de 20 litros',
  })
  description: string;

  @ApiProperty({
    description: 'Cantidad del producto en la suscripción',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Indica si el producto es retornable',
    example: true,
  })
  is_returnable: boolean;

  @ApiProperty({
    description: 'Precio unitario del producto',
    example: 25.50,
  })
  unit_price: number;
}

export class CancellationOrderCustomerDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 1,
  })
  customer_id: number;

  @ApiProperty({
    description: 'Nombre completo del cliente',
    example: 'Juan Pérez',
  })
  full_name: string;

  @ApiProperty({
    description: 'Teléfono del cliente',
    example: '+1234567890',
  })
  phone: string;

  @ApiProperty({
    description: 'Dirección del cliente',
    example: 'Calle Principal 123, Ciudad',
  })
  address: string;
}

export class CancellationOrderWithProductsDto {
  @ApiProperty({
    description: 'ID de la orden de cancelación',
    example: 1,
  })
  cancellation_order_id: number;

  @ApiProperty({
    description: 'ID de la suscripción',
    example: 1,
  })
  subscription_id: number;

  @ApiProperty({
    description: 'Fecha programada para la recolección',
    example: '2024-12-25T10:00:00Z',
  })
  scheduled_collection_date: Date;

  @ApiPropertyOptional({
    description: 'Fecha real de recolección',
    example: '2024-12-25T14:30:00Z',
  })
  actual_collection_date?: Date;

  @ApiProperty({
    description: 'Estado de la orden de cancelación',
    enum: CancellationOrderStatus,
    example: CancellationOrderStatus.PENDING,
  })
  status: CancellationOrderStatus;

  @ApiPropertyOptional({
    description: 'ID de la hoja de ruta asignada',
    example: 1,
  })
  route_sheet_id?: number;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Cliente solicita recolección en horario específico',
  })
  notes?: string;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2024-12-20T08:00:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2024-12-20T08:00:00Z',
  })
  updated_at: Date;

  @ApiProperty({
    description: 'Número de veces que se ha reprogramado',
    example: 0,
  })
  rescheduled_count: number;

  @ApiProperty({
    description: 'Información del cliente',
    type: CancellationOrderCustomerDto,
  })
  customer: CancellationOrderCustomerDto;

  @ApiProperty({
    description: 'Lista de productos de la suscripción',
    type: [CancellationOrderProductDto],
  })
  products: CancellationOrderProductDto[];

  @ApiPropertyOptional({
    description: 'Información de la hoja de ruta asignada',
  })
  route_sheet?: {
    route_sheet_id: number;
    delivery_date: Date;
    driver_id: number;
    vehicle_id: number;
  };
}