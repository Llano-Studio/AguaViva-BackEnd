import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerInfoDto {
  @ApiProperty({
    description: 'ID de la persona',
    example: 1
  })
  person_id: number;

  @ApiProperty({
    description: 'Nombre del cliente',
    example: 'Juan Pérez'
  })
  name: string;

  @ApiProperty({
    description: 'Teléfono del cliente',
    example: '+54911234567'
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Dirección del cliente',
    example: 'Av. Corrientes 1234'
  })
  address?: string;

  @ApiPropertyOptional({
    description: 'Nombre de la zona',
    example: 'Centro'
  })
  zone_name?: string;
}

export class PendingCycleDto {
  @ApiProperty({
    description: 'ID del ciclo',
    example: 45
  })
  cycle_id: number;

  @ApiProperty({
    description: 'ID de la suscripción',
    example: 12
  })
  subscription_id: number;

  @ApiProperty({
    description: 'Nombre del plan de suscripción',
    example: 'Plan Familiar'
  })
  subscription_plan_name: string;

  @ApiProperty({
    description: 'Número del ciclo',
    example: 3
  })
  cycle_number: number;

  @ApiProperty({
    description: 'Fecha de vencimiento del pago',
    example: '2024-01-15'
  })
  payment_due_date: string;

  @ApiProperty({
    description: 'Saldo pendiente',
    example: 250.00
  })
  pending_balance: number;

  @ApiProperty({
    description: 'Días de vencimiento',
    example: 5
  })
  days_overdue: number;

  @ApiProperty({
    description: 'Estado del pago',
    example: 'OVERDUE',
    enum: ['PENDING', 'OVERDUE', 'PARTIAL']
  })
  payment_status: string;
}

export class PendingCyclesResponseDto {
  @ApiProperty({
    description: 'Información del cliente',
    type: CustomerInfoDto
  })
  customer_info: CustomerInfoDto;

  @ApiProperty({
    description: 'Ciclos con saldo pendiente',
    type: [PendingCycleDto]
  })
  pending_cycles: PendingCycleDto[];

  @ApiProperty({
    description: 'Total de saldo pendiente',
    example: 750.00
  })
  total_pending: number;
}