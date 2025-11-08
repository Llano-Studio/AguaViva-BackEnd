import { ApiProperty } from '@nestjs/swagger';

export class DeleteAutomatedCollectionResponseDto {
  @ApiProperty({
    description: 'Indica si la eliminación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Cobranza automática eliminada exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'ID del pedido eliminado',
    example: 123,
  })
  deletedOrderId: number;

  @ApiProperty({
    description: 'Fecha y hora de la eliminación',
    example: '2024-01-15T10:30:45Z',
  })
  deletedAt: string;

  @ApiProperty({
    description: 'Información adicional sobre la eliminación',
    type: 'object',
    properties: {
      was_paid: { type: 'boolean', example: false },
      had_pending_amount: { type: 'string', example: '150.00' },
      customer_name: { type: 'string', example: 'Juan Pérez' },
      deletion_type: { type: 'string', example: 'logical' },
    },
  })
  deletionInfo: {
    was_paid: boolean;
    had_pending_amount: string;
    customer_name: string;
    deletion_type: 'logical' | 'physical';
  };
}