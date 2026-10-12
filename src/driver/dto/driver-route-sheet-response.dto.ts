import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RouteSheetExecutionStatus,
  RouteSheetPauseReason,
} from '@prisma/client';

export enum DriverStopType {
  ORDER = 'ORDER',
  ONE_OFF = 'ONE_OFF',
  CANCELLATION = 'CANCELLATION',
  COLLECTION = 'COLLECTION',
}

export class DriverVehicleDto {
  @ApiProperty({ example: 1 })
  vehicle_id: number;

  @ApiProperty({ example: 'CAM-01' })
  code: string;

  @ApiProperty({ example: 'Camión 1' })
  name: string;
}

export class DriverRouteSheetPauseDto {
  @ApiProperty({ enum: RouteSheetPauseReason })
  reason: RouteSheetPauseReason;

  @ApiPropertyOptional({ nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-10-12T11:30:00-03:00' })
  paused_at: string;
}

export class DriverRouteSheetTotalsDto {
  @ApiProperty({ description: 'Entregas en la hoja', example: 12 })
  total: number;

  @ApiProperty({ description: 'Entregas sin resolver', example: 7 })
  pending: number;

  @ApiProperty({ description: 'Entregas realizadas', example: 4 })
  delivered: number;

  @ApiProperty({
    description: 'Entregas no realizadas (fallidas o saltadas)',
    example: 1,
  })
  not_delivered: number;
}

export class DriverRouteSheetSummaryDto {
  @ApiProperty({ description: 'Número de hoja de ruta', example: 345 })
  route_sheet_id: number;

  @ApiProperty({ example: '2026-10-12' })
  delivery_date: string;

  @ApiProperty({ enum: RouteSheetExecutionStatus })
  execution_status: RouteSheetExecutionStatus;

  @ApiPropertyOptional({
    description: 'Momento en que el chofer inició el recorrido',
    nullable: true,
  })
  started_at: string | null;

  @ApiPropertyOptional({
    description:
      'Primer horario de entrega programado en la hoja (HH:MM), si hay alguno',
    nullable: true,
    example: '08:00',
  })
  scheduled_start_time: string | null;

  @ApiPropertyOptional({ nullable: true })
  closed_at: string | null;

  @ApiPropertyOptional({ nullable: true })
  route_notes: string | null;

  @ApiProperty({ type: DriverVehicleDto })
  vehicle: DriverVehicleDto;

  @ApiProperty({ type: DriverRouteSheetTotalsDto })
  totals: DriverRouteSheetTotalsDto;

  @ApiPropertyOptional({
    type: DriverRouteSheetPauseDto,
    nullable: true,
    description: 'Pausa abierta, si la hoja está pausada',
  })
  active_pause: DriverRouteSheetPauseDto | null;
}

export class DriverDeliveryCustomerDto {
  @ApiProperty({ example: 10 })
  person_id: number;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;

  @ApiPropertyOptional({ nullable: true })
  alias: string | null;

  @ApiPropertyOptional({ nullable: true })
  address: string | null;

  @ApiProperty({ example: '3624123456' })
  phone: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Ubicación del cliente (AguaViva no la registra: siempre null)',
  })
  location: string | null;
}

export class DriverRouteSheetDeliveryDto {
  @ApiProperty({ example: 1001 })
  route_sheet_detail_id: number;

  @ApiProperty({
    description: 'Posición en el recorrido (1 = primera parada)',
    example: 1,
  })
  position: number;

  @ApiPropertyOptional({ nullable: true })
  sequence_number: number | null;

  @ApiProperty({ example: 'PENDING' })
  delivery_status: string;

  @ApiProperty({ description: 'Ya fue resuelta (entregada, fallida, etc.)' })
  is_resolved: boolean;

  @ApiProperty({
    description:
      'Es la entrega habilitada para operar. Solo hay una y solo con la hoja en curso.',
  })
  is_current: boolean;

  @ApiProperty({
    description: 'Pendiente y bloqueada hasta resolver las anteriores',
  })
  is_locked: boolean;

  @ApiPropertyOptional({ nullable: true, example: '08:00-10:00' })
  delivery_time: string | null;

  @ApiProperty({
    enum: DriverStopType,
    description:
      'Tipo de parada: pedido, compra única, retiro por cancelación o cobranza',
  })
  stop_type: DriverStopType;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'ID del registro según stop_type (order_id, purchase_id, cancellation_order_id o payment_id)',
  })
  reference_id: number | null;

  @ApiPropertyOptional({ nullable: true })
  order_id: number | null;

  @ApiPropertyOptional({ nullable: true, example: '15000.00' })
  total_amount: string | null;

  @ApiPropertyOptional({ nullable: true, example: '0.00' })
  paid_amount: string | null;

  @ApiPropertyOptional({ type: DriverDeliveryCustomerDto, nullable: true })
  customer: DriverDeliveryCustomerDto | null;
}

export class DriverRouteSheetDetailDto extends DriverRouteSheetSummaryDto {
  @ApiPropertyOptional({
    description: 'Entrega habilitada actualmente',
    nullable: true,
  })
  current_detail_id: number | null;

  @ApiProperty({
    description:
      'Todas las entregas están resueltas y la hoja está en curso (puede rendir y cerrar)',
  })
  can_close: boolean;

  @ApiProperty({ type: [DriverRouteSheetDeliveryDto] })
  deliveries: DriverRouteSheetDeliveryDto[];
}
