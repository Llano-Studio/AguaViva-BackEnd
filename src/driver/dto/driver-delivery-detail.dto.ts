import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RouteSheetExecutionStatus } from '@prisma/client';
import {
  DriverDeliveryCustomerDto,
  DriverStopType,
} from './driver-route-sheet-response.dto';

/** Acciones que el chofer puede ejecutar sobre la parada actual. */
export enum DriverDeliveryAction {
  VISIT = 'VISIT',
  DELIVER = 'DELIVER',
  SKIP = 'SKIP',
}

export class DriverDeliveryDetailCustomerDto extends DriverDeliveryCustomerDto {
  @ApiPropertyOptional({ nullable: true })
  tax_id: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;
}

export class DriverDeliveryItemDto {
  @ApiProperty({ example: 9001 })
  order_item_id: number;

  @ApiProperty({ example: 4 })
  product_id: number;

  @ApiProperty({ example: 'Bidón 20L retornable' })
  product_description: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 0 })
  delivered_quantity: number;

  @ApiProperty({ example: 0 })
  returned_quantity: number;

  @ApiProperty({ example: '1200.00' })
  unit_price: string;

  @ApiProperty({ example: '2400.00' })
  subtotal: string;
}

export class DriverDeliveryOrderDto {
  @ApiProperty({ example: 501 })
  order_id: number;

  @ApiProperty({ example: 'CONTRACT_DELIVERY' })
  order_type: string;

  @ApiProperty({ example: 'READY_FOR_DELIVERY' })
  status: string;

  @ApiProperty({ example: 'PENDING' })
  payment_status: string;

  @ApiProperty({ example: '2026-10-12T08:30:00-03:00' })
  order_date: string;

  @ApiProperty({ example: '15000.00' })
  total_amount: string;

  @ApiProperty({ example: '0.00' })
  paid_amount: string;

  @ApiProperty({ example: '15000.00' })
  debt_amount: string;

  @ApiProperty({ type: [DriverDeliveryItemDto] })
  items: DriverDeliveryItemDto[];

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;
}

export class DriverDeliveryPaymentDto {
  @ApiProperty({ example: 7001 })
  transaction_id: number;

  @ApiProperty({ example: '2026-10-10T11:05:00-03:00' })
  transaction_date: string;

  @ApiProperty({ example: '5000.00' })
  amount: string;

  @ApiProperty({ example: 'EFECTIVO' })
  payment_method: string;

  @ApiPropertyOptional({ nullable: true })
  document_number: string | null;

  @ApiPropertyOptional({ nullable: true })
  receipt_number: string | null;
}

export class DriverDeliveryDetailDto {
  @ApiProperty({ example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: 1002 })
  route_sheet_detail_id: number;

  @ApiProperty({ enum: RouteSheetExecutionStatus })
  execution_status: RouteSheetExecutionStatus;

  @ApiProperty({ example: 'PENDING' })
  delivery_status: string;

  @ApiProperty({
    description:
      'Es la parada habilitada para operar (primera sin resolver con la hoja en curso)',
  })
  is_current: boolean;

  @ApiProperty({ description: 'Está resuelta (entregada, fallida, etc.)' })
  is_resolved: boolean;

  @ApiProperty({ enum: DriverStopType })
  stop_type: DriverStopType;

  @ApiPropertyOptional({ nullable: true, example: '08:30-10:00' })
  delivery_time: string | null;

  @ApiProperty({
    description:
      'Hash del estado mutable de la parada. Si cambia, el front recargó con datos viejos',
    example: '3f9a1c7d5b2e4a60',
  })
  version: string;

  @ApiProperty({
    enum: DriverDeliveryAction,
    isArray: true,
    description: 'Acciones habilitadas según el estado de la hoja y la parada',
  })
  allowed_actions: DriverDeliveryAction[];

  @ApiProperty({ type: DriverDeliveryDetailCustomerDto })
  customer: DriverDeliveryDetailCustomerDto;

  @ApiPropertyOptional({ type: DriverDeliveryOrderDto, nullable: true })
  order: DriverDeliveryOrderDto | null;

  @ApiProperty({
    type: [DriverDeliveryPaymentDto],
    description: 'Pagos registrados previamente sobre el pedido',
  })
  previous_payments: DriverDeliveryPaymentDto[];

  @ApiProperty({
    type: [Object],
    description:
      'Créditos de producto a favor del cliente. AguaViva no genera créditos, siempre vacío.',
  })
  credits: unknown[];
}
