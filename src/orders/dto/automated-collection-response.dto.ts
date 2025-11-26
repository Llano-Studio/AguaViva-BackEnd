import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '../../common/constants/enums';

export class AutomatedCollectionCustomerDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 1,
  })
  customer_id: number;

  @ApiProperty({
    description: 'Nombre completo del cliente',
    example: 'Juan Pérez',
  })
  name: string;

  @ApiProperty({
    description: 'Número de documento del cliente',
    example: '12345678',
    nullable: true,
  })
  document_number?: string;

  @ApiProperty({
    description: 'Teléfono del cliente',
    example: '+54 9 11 1234-5678',
    nullable: true,
  })
  phone?: string;

  @ApiProperty({
    description: 'Email del cliente',
    example: 'juan.perez@email.com',
    nullable: true,
  })
  email?: string;

  @ApiProperty({
    description: 'Dirección del cliente',
    example: 'Av. Principal 123, Centro',
    nullable: true,
  })
  address?: string;

  @ApiProperty({
    description: 'Zona del cliente',
    type: 'object',
    properties: {
      zone_id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Centro' },
    },
    nullable: true,
  })
  zone?: {
    zone_id: number;
    name: string;
  };
}

export class AutomatedCollectionSubscriptionDto {
  @ApiProperty({
    description: 'ID de la suscripción',
    example: 1,
  })
  subscription_id: number;

  @ApiProperty({
    description: 'Plan de suscripción',
    type: 'object',
    properties: {
      subscription_plan_id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Plan Familiar Mensual' },
      price: { type: 'string', example: '150.00' },
      billing_frequency: { type: 'string', example: 'MONTHLY' },
    },
  })
  subscription_plan: {
    subscription_plan_id: number;
    name: string;
    price: string;
    billing_frequency: string;
  };

  @ApiProperty({
    description: 'Información del ciclo de cobranza',
    type: 'object',
    properties: {
      cycle_id: { type: 'number', example: 1 },
      cycle_number: { type: 'number', example: 3 },
      start_date: { type: 'string', example: '2024-01-01T00:00:00Z' },
      end_date: { type: 'string', example: '2024-01-31T23:59:59Z' },
      due_date: { type: 'string', example: '2024-02-05T00:00:00Z' },
      pending_balance: { type: 'string', example: '150.00' },
    },
    nullable: true,
  })
  cycle_info?: {
    cycle_id: number;
    cycle_number: number;
    start_date: string;
    end_date: string;
    due_date: string;
    pending_balance: string;
  };
}

export class AutomatedCollectionResponseDto {
  @ApiProperty({
    description: 'ID del pedido de cobranza automática',
    example: 1,
  })
  order_id: number;

  @ApiProperty({
    description: 'Fecha de creación del pedido',
    example: '2024-01-15T10:30:00Z',
  })
  order_date: string;

  @ApiProperty({
    description: 'Fecha de vencimiento de la cobranza',
    example: '2024-02-05T00:00:00Z',
    nullable: true,
  })
  due_date?: string;

  @ApiProperty({
    description: 'Monto total a cobrar',
    example: '150.00',
  })
  total_amount: string;

  @ApiProperty({
    description: 'Monto ya pagado',
    example: '0.00',
  })
  paid_amount: string;

  @ApiProperty({
    description: 'Monto pendiente de pago',
    example: '150.00',
  })
  pending_amount: string;

  @ApiProperty({
    description: 'Estado del pedido',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @ApiProperty({
    description: 'Estado del pago',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  payment_status: PaymentStatus;

  @ApiProperty({
    description: 'Notas de la cobranza automática',
    example: 'COBRANZA AUTOMÁTICA - Plan Familiar Mensual - Ciclo 3 - $150.00',
    nullable: true,
  })
  notes?: string;

  @ApiProperty({
    description: 'Indica si la cobranza está vencida',
    example: false,
  })
  is_overdue: boolean;

  @ApiProperty({
    description: 'Días de atraso (si está vencida)',
    example: 0,
  })
  days_overdue: number;

  @ApiProperty({
    description: 'Información del cliente',
    type: AutomatedCollectionCustomerDto,
  })
  customer: AutomatedCollectionCustomerDto;

  @ApiProperty({
    description: 'Información de la suscripción y ciclo',
    type: AutomatedCollectionSubscriptionDto,
    nullable: true,
  })
  subscription_info?: AutomatedCollectionSubscriptionDto;

  @ApiProperty({
    description: 'Fecha de creación del registro',
    example: '2024-01-15T10:30:00Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2024-01-15T10:30:00Z',
  })
  updated_at: string;
}

export class AutomatedCollectionListResponseDto {
  @ApiProperty({
    description: 'Lista de cobranzas automáticas',
    type: [AutomatedCollectionResponseDto],
  })
  data: AutomatedCollectionResponseDto[];

  @ApiProperty({
    description: 'Información de paginación',
    type: 'object',
    properties: {
      total: { type: 'number', example: 150 },
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 },
      totalPages: { type: 'number', example: 8 },
      hasNext: { type: 'boolean', example: true },
      hasPrev: { type: 'boolean', example: false },
    },
  })
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  @ApiProperty({
    description: 'Resumen de montos',
    type: 'object',
    properties: {
      total_amount: { type: 'string', example: '15000.00' },
      total_paid: { type: 'string', example: '5000.00' },
      total_pending: { type: 'string', example: '10000.00' },
      overdue_amount: { type: 'string', example: '2000.00' },
      overdue_count: { type: 'number', example: 15 },
    },
  })
  summary: {
    total_amount: string;
    total_paid: string;
    total_pending: string;
    overdue_amount: string;
    overdue_count: number;
  };
}
