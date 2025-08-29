import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CyclePaymentResponseDto {
  @ApiProperty({
    description: 'ID único del pago de ciclo',
    example: 1
  })
  payment_id: number;

  @ApiProperty({
    description: 'ID del ciclo de suscripción',
    example: 1
  })
  cycle_id: number;

  @ApiProperty({
    description: 'Fecha del pago',
    example: '2024-01-15T10:30:00.000Z'
  })
  payment_date: Date;

  @ApiProperty({
    description: 'Monto del pago',
    example: 15000.00
  })
  amount: number;

  @ApiProperty({
    description: 'Método de pago utilizado',
    example: 'EFECTIVO'
  })
  payment_method: string;

  @ApiPropertyOptional({
    description: 'Referencia del pago',
    example: 'TRANS-001234'
  })
  reference?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Pago correspondiente al ciclo de enero 2024'
  })
  notes?: string;

  @ApiProperty({
    description: 'ID del usuario que registró el pago',
    example: 1
  })
  created_by: number;
}

export class CyclePaymentSummaryDto {
  @ApiProperty({
    description: 'ID del ciclo de suscripción',
    example: 1
  })
  cycle_id: number;

  @ApiProperty({
    description: 'Monto total del ciclo',
    example: 20000.00
  })
  total_amount: number;

  @ApiProperty({
    description: 'Monto pagado hasta el momento',
    example: 15000.00
  })
  paid_amount: number;

  @ApiProperty({
    description: 'Saldo pendiente',
    example: 5000.00
  })
  pending_balance: number;

  @ApiProperty({
    description: 'Crédito acumulado a favor del cliente',
    example: 2000.00
  })
  credit_balance: number;

  @ApiProperty({
    description: 'Estado del pago del ciclo',
    example: 'PARCIAL',
    enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CREDITED']
  })
  payment_status: string;

  @ApiProperty({
    description: 'Fecha de vencimiento del pago',
    example: '2024-01-31T23:59:59.000Z'
  })
  payment_due_date: Date;

  @ApiProperty({
    description: 'Lista de pagos realizados para este ciclo',
    type: [CyclePaymentResponseDto]
  })
  payments: CyclePaymentResponseDto[];
}