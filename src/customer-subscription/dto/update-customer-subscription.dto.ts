import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  IsDateString,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus, PaymentMode } from '@prisma/client';
import { DeliveryPreferences } from './customer-subscription-response.dto';

export class UpdateCustomerSubscriptionDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  subscription_plan_id?: number;

  // end_date field removed - not present in schema

  @ApiPropertyOptional({
    description: 'Nuevo día del mes para recolección (1-28)',
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
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiProperty({
    example: 'Cliente VIP - entrega prioritaria',
    required: false,
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
