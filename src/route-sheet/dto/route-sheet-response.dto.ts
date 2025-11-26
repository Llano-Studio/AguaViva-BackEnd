import { ApiProperty } from '@nestjs/swagger';
import { DeliveryStatus } from '../../common/constants/enums';

export class CustomerDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 1,
  })
  person_id: number;

  @ApiProperty({
    description: 'Nombre del cliente',
    example: 'Juan Pérez',
  })
  name: string;

  @ApiProperty({
    description: 'Alias del cliente',
    example: 'JP',
    required: false,
  })
  alias?: string;

  @ApiProperty({
    description: 'Teléfono del cliente',
    example: '+541155556666',
  })
  phone: string;

  @ApiProperty({
    description: 'Dirección del cliente',
    example: 'Av. Rivadavia 1234',
  })
  address: string;

  @ApiProperty({
    description: 'Zona del cliente',
    required: false,
  })
  zone?: {
    zone_id: number;
    code: string;
    name: string;
  };

  @ApiProperty({
    description: 'Localidad del cliente',
    required: false,
  })
  locality?: {
    locality_id: number;
    code: string;
    name: string;
  };

  @ApiProperty({
    description: 'Instrucciones especiales de entrega',
    example: 'Dejar en portería',
    required: false,
  })
  special_instructions?: string;
}

export class ProductDto {
  @ApiProperty({
    description: 'ID del producto',
    example: 1,
  })
  product_id: number;

  @ApiProperty({
    description: 'Descripción del producto',
    example: 'Botellón de agua 20L',
  })
  description: string;
}

export class OrderItemDto {
  @ApiProperty({
    description: 'ID del ítem del pedido',
    example: 1,
  })
  order_item_id: number;

  @ApiProperty({
    description: 'Producto',
    type: ProductDto,
  })
  product: ProductDto;

  @ApiProperty({
    description: 'Cantidad',
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: 'Cantidad entregada',
    example: 0,
  })
  delivered_quantity: number;

  @ApiProperty({
    description: 'Cantidad devuelta',
    example: 0,
  })
  returned_quantity: number;
}

export class OrderDto {
  @ApiProperty({
    description: 'ID del pedido',
    example: 1,
  })
  order_id: number;

  @ApiProperty({
    description: 'Fecha del pedido',
    example: '2023-07-10T15:00:00Z',
  })
  order_date: string;

  @ApiProperty({
    description: 'Monto total',
    example: '1500.00',
  })
  total_amount: string;

  @ApiProperty({
    description: 'Estado del pedido',
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({
    description: 'ID de suscripción asociada (si aplica)',
    example: 42,
    required: false,
  })
  subscription_id?: number;

  @ApiProperty({
    description: 'Fecha de vencimiento del abono (ciclo actual)',
    example: '2025-11-30',
    required: false,
  })
  subscription_due_date?: string;

  @ApiProperty({
    description: 'Lista completa de fechas de vencimiento pendientes',
    example: ['2025-11-30', '2025-12-30'],
    required: false,
  })
  all_due_dates?: string[];

  @ApiProperty({
    description: 'Cliente',
    type: CustomerDto,
  })
  customer: CustomerDto;

  @ApiProperty({
    description: 'Ítems del pedido',
    type: [OrderItemDto],
  })
  items: OrderItemDto[];

  @ApiProperty({
    description: 'Notas del pedido',
    required: false,
  })
  notes?: string;
}

export class RouteSheetDetailResponseDto {
  @ApiProperty({
    description: 'ID del detalle de hoja de ruta',
    example: 1,
  })
  route_sheet_detail_id: number;

  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 1,
  })
  route_sheet_id: number;

  @ApiProperty({
    description: 'Pedido a entregar',
    type: OrderDto,
    required: false,
  })
  order?: OrderDto;

  @ApiProperty({
    description: 'Estado de la entrega',
    enum: DeliveryStatus,
    example: DeliveryStatus.PENDING,
    examples: {
      pending: {
        value: DeliveryStatus.PENDING,
        description: 'Entrega pendiente'
      },
      assigned: {
        value: DeliveryStatus.ASSIGNED,
        description: 'Asignado al conductor'
      },
      inTransit: {
        value: DeliveryStatus.IN_TRANSIT,
        description: 'En tránsito'
      },
      delivered: {
        value: DeliveryStatus.DELIVERED,
        description: 'Entregado exitosamente'
      },
      failed: {
        value: DeliveryStatus.FAILED,
        description: 'Entrega fallida'
      }
    }
  })
  delivery_status: DeliveryStatus;

  @ApiProperty({
    description:
      'Horario de entrega. Puede ser un horario específico (HH:MM) o un rango (HH:MM-HH:MM)',
    example: '08:00-16:00',
    required: false,
  })
  delivery_time?: string;

  @ApiProperty({
    description: 'Comentarios',
    example: 'Llamar al cliente antes de entregar',
    required: false,
  })
  comments?: string;

  @ApiProperty({
    description: 'ID de firma digital',
    example: 'sign-123-456',
    required: false,
  })
  digital_signature_id?: string;

  @ApiProperty({
    description:
      'Indica si esta es la entrega actual que el chofer debe atender',
    example: true,
    required: false, // Se calculará en el backend
  })
  is_current_delivery?: boolean;

  @ApiProperty({
    description: 'Créditos/saldo de productos asociados a suscripción',
    required: false,
  })
  credits?: {
    product_description: string;
    planned_quantity: number;
    delivered_quantity: number;
    remaining_balance: number;
  }[];
}

export class DriverDto {
  @ApiProperty({
    description: 'ID del chofer',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Nombre del chofer',
    example: 'Carlos Rodríguez',
  })
  name: string;

  @ApiProperty({
    description: 'Email del chofer',
    example: 'carlos@example.com',
  })
  email: string;
}

export class ZoneDto {
  @ApiProperty({
    description: 'ID de la zona',
    example: 1,
  })
  zone_id: number;

  @ApiProperty({
    description: 'Código de la zona',
    example: 'ZN-001',
  })
  code: string;

  @ApiProperty({
    description: 'Nombre de la zona',
    example: 'Centro',
  })
  name: string;

  @ApiProperty({
    description: 'Información de la localidad',
    required: false,
  })
  locality?: {
    locality_id: number;
    code: string;
    name: string;
    province: {
      province_id: number;
      code: string;
      name: string;
      country: {
        country_id: number;
        code: string;
        name: string;
      };
    };
  };
}

export class VehicleDto {
  @ApiProperty({
    description: 'ID del vehículo',
    example: 1,
  })
  vehicle_id: number;

  @ApiProperty({
    description: 'Código del vehículo',
    example: 'TRK-001',
  })
  code: string;

  @ApiProperty({
    description: 'Nombre del vehículo',
    example: 'Camión Mercedes',
  })
  name: string;

  @ApiProperty({
    description: 'Zonas asignadas al vehículo',
    type: [ZoneDto],
    required: false,
  })
  zones?: ZoneDto[];
}

export class RouteSheetResponseDto {
  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 1,
  })
  route_sheet_id: number;

  @ApiProperty({
    description: 'Conductor asignado',
    type: DriverDto,
  })
  driver: DriverDto;

  @ApiProperty({
    description: 'Vehículo asignado',
    type: VehicleDto,
  })
  vehicle: VehicleDto;

  @ApiProperty({
    description: 'Fecha de entrega',
    example: '2023-07-15',
  })
  delivery_date: string;

  @ApiProperty({
    description: 'Notas sobre la ruta',
    example: 'Ruta por zona norte',
    required: false,
  })
  route_notes?: string;

  @ApiProperty({
    description: 'Detalles de las entregas',
    type: [RouteSheetDetailResponseDto],
  })
  details: RouteSheetDetailResponseDto[];

  @ApiProperty({
    description:
      'Zonas cubiertas por los detalles de la hoja de ruta (derivadas de pedidos y clientes)',
    type: [ZoneDto],
    required: false,
  })
  zones_covered?: ZoneDto[];

  constructor(partial: Partial<RouteSheetResponseDto>) {
    Object.assign(this, partial);
  }
}
