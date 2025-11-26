import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentOperationResponseDto {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Pago actualizado exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'ID del registro de auditoría generado',
    example: 12345,
  })
  audit_id: number;

  @ApiPropertyOptional({
    description: 'Metadatos adicionales de la operación',
    example: {
      operation_type: 'UPDATE',
      timestamp: '2024-01-15T10:30:00.000Z',
      affected_records: 1,
    },
  })
  metadata?: {
    operation_type: string;
    timestamp: string;
    affected_records: number;
  };
}
