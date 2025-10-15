import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentOperationResponseDto {
  @ApiProperty({
    description: 'Estado de la operación',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Pago actualizado exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'ID del registro de auditoría',
    example: 123,
  })
  audit_id: number;

  @ApiPropertyOptional({
    description: 'Datos del pago actualizado (solo para operaciones de edición)',
  })
  data?: any;

  @ApiPropertyOptional({
    description: 'Información adicional sobre la operación',
  })
  metadata?: {
    operation_type: 'UPDATE' | 'DELETE';
    timestamp: string;
    affected_records: number;
  };
}