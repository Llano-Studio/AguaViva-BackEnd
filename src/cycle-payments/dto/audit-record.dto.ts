import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../../common/constants/enums';

export class AuditRecordDto {
  @ApiProperty({
    description: 'ID único del registro de auditoría',
    example: 123,
  })
  audit_id: number;

  @ApiProperty({
    description: 'Nombre de la tabla afectada',
    example: 'cycle_payment',
  })
  table_name: string;

  @ApiProperty({
    description: 'ID del registro afectado',
    example: 456,
  })
  record_id: number;

  @ApiProperty({
    description: 'Tipo de operación realizada',
    example: 'UPDATE',
    enum: ['UPDATE', 'DELETE'],
  })
  operation_type: 'UPDATE' | 'DELETE';

  @ApiPropertyOptional({
    description: 'Valores anteriores del registro (JSON)',
    example: { amount: 20000, payment_method: PaymentMethod.EFECTIVO },
  })
  old_values?: any;

  @ApiPropertyOptional({
    description: 'Valores nuevos del registro (JSON)',
    example: { amount: 25000, payment_method: PaymentMethod.TRANSFERENCIA },
  })
  new_values?: any;

  @ApiProperty({
    description: 'Fecha y hora de la operación',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at: string;

  @ApiProperty({
    description: 'ID del usuario que realizó la operación',
    example: 789,
  })
  created_by: number;

  @ApiPropertyOptional({
    description: 'Motivo de la operación',
    example: 'Corrección de monto por error de captura',
  })
  reason?: string;

  @ApiPropertyOptional({
    description: 'Dirección IP desde donde se realizó la operación',
    example: '192.168.1.100',
  })
  ip_address?: string;

  @ApiPropertyOptional({
    description: 'User Agent del navegador/cliente',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  user_agent?: string;

  @ApiPropertyOptional({
    description: 'Información del usuario que realizó la operación',
  })
  user?: {
    user_id: number;
    username: string;
    email: string;
    role: string;
  };
}
