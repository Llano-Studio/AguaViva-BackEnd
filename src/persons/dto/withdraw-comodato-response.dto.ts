import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawComodatoResponseDto {
  @ApiProperty({
    description: 'Indica si el retiro fue procesado exitosamente',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Retiro de comodato procesado exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'ID del comodato retirado',
    example: 1,
  })
  comodato_id: number;

  @ApiPropertyOptional({
    description: 'ID de la orden de retiro creada',
    example: 123,
  })
  withdrawal_order_id?: number;

  @ApiPropertyOptional({
    description: 'ID de la orden de recuperación creada (si aplica)',
    example: 456,
  })
  recovery_order_id?: number;

  @ApiProperty({
    description: 'Fecha programada para el retiro',
    example: '2024-01-20T10:00:00.000Z',
  })
  scheduled_withdrawal_date: Date;

  @ApiProperty({
    description: 'Estado actualizado del comodato',
    example: 'PENDING_WITHDRAWAL',
  })
  comodato_status: string;

  @ApiPropertyOptional({
    description: 'Información del producto del comodato',
    example: {
      product_id: 1,
      product_name: 'Bidón 20L',
      quantity: 2,
    },
  })
  product_info?: {
    product_id: number;
    product_name: string;
    quantity: number;
  };

  @ApiPropertyOptional({
    description: 'Información de la suscripción asociada',
    example: {
      subscription_id: 7,
      subscription_status: 'ACTIVE',
      plan_name: 'Plan Familiar',
    },
  })
  subscription_info?: {
    subscription_id: number;
    subscription_status: string;
    plan_name: string;
  };
}