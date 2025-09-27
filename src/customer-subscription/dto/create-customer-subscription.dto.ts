import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus, PaymentMode } from '@prisma/client';
import { DeliveryPreferences } from './customer-subscription-response.dto';

export class CreateCustomerSubscriptionDto {
  @ApiProperty({
    description:
      'ID único del cliente que se suscribe al servicio. Debe ser un cliente registrado en el sistema.',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  customer_id: number;

  @ApiProperty({
    description:
      'ID del plan de suscripción seleccionado. Debe ser un plan activo y disponible en el sistema.',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  subscription_plan_id: number;

  @ApiProperty({
    description:
      'Fecha de inicio de la suscripción en formato YYYY-MM-DD. Determina cuándo comienzan los ciclos de entrega.',
    example: '2024-01-01',
    format: 'date',
  })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  // end_date field removed - not present in schema

  @ApiPropertyOptional({
    description: 'Día del mes para recolección de bidones (1-28), opcional',
    example: 15,
    minimum: 1,
    maximum: 28,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  @Type(() => Number)
  collection_day?: number;

  @ApiPropertyOptional({
    description: 'Modalidad de pago: ADVANCE (adelantado) o ARREARS (vencido)',
    enum: PaymentMode,
    example: PaymentMode.ADVANCE,
    default: PaymentMode.ADVANCE,
  })
  @IsOptional()
  @IsEnum(PaymentMode)
  payment_mode?: PaymentMode;

  @ApiPropertyOptional({
    description:
      'Día específico de vencimiento para pagos vencidos (1-28). Solo aplica cuando payment_mode = ARREARS',
    example: 10,
    minimum: 1,
    maximum: 28,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  @Type(() => Number)
  payment_due_day?: number;

  @ApiProperty({
    description: 'Estado inicial de la suscripción',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @IsEnum(SubscriptionStatus)
  @IsNotEmpty()
  status: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre la suscripción',
    example: 'Suscripción creada por promoción especial',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: DeliveryPreferences,
    description: 'Preferencias de horario de entrega',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryPreferences)
  delivery_preferences?: DeliveryPreferences;
}
