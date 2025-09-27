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
  IsNumber,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  SubscriptionStatus,
  ComodatoStatus,
  PaymentMode,
} from '@prisma/client';
import { DeliveryPreferences } from '../../customer-subscription/dto/customer-subscription-response.dto';

export class CreateSubscriptionWithComodatoDto {
  @ApiProperty({
    description: 'ID del cliente que se suscribe',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  customer_id: number;

  @ApiProperty({
    description: 'ID del plan de suscripción',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  subscription_plan_id: number;

  @ApiProperty({
    description: 'Fecha de inicio de la suscripción (YYYY-MM-DD)',
    example: '2024-01-01',
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

  // Campos específicos del comodato
  @ApiProperty({
    description: 'ID del producto en comodato',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  comodato_product_id: number;

  @ApiProperty({
    description: 'Cantidad de productos en comodato',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @IsPositive()
  @Type(() => Number)
  comodato_quantity: number;

  @ApiProperty({
    description: 'Fecha de entrega del comodato (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsNotEmpty()
  comodato_delivery_date: string;

  @ApiPropertyOptional({
    description: 'Fecha esperada de devolución del comodato (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  comodato_expected_return_date?: string;

  @ApiProperty({
    description: 'Estado inicial del comodato',
    enum: ComodatoStatus,
    example: ComodatoStatus.ACTIVE,
  })
  @IsEnum(ComodatoStatus)
  @IsNotEmpty()
  comodato_status: ComodatoStatus;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el comodato',
    example: 'Dispensador entregado en buen estado',
  })
  @IsOptional()
  @IsString()
  comodato_notes?: string;

  @ApiPropertyOptional({
    description: 'Monto del depósito del comodato',
    example: 50000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  comodato_deposit_amount?: number;

  @ApiPropertyOptional({
    description: 'Cuota mensual del comodato',
    example: 5000.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  comodato_monthly_fee?: number;

  @ApiPropertyOptional({
    description: 'Descripción del artículo en comodato',
    example: 'Dispensador de agua fría y caliente',
  })
  @IsOptional()
  @IsString()
  comodato_article_description?: string;

  @ApiPropertyOptional({
    description: 'Marca del artículo en comodato',
    example: 'Samsung',
  })
  @IsOptional()
  @IsString()
  comodato_brand?: string;

  @ApiPropertyOptional({
    description: 'Modelo del artículo en comodato',
    example: 'WD-500X',
  })
  @IsOptional()
  @IsString()
  comodato_model?: string;

  @ApiPropertyOptional({
    description: 'Ruta de la imagen del contrato del comodato',
    example: '/uploads/contracts/comodato_123.pdf',
  })
  @IsOptional()
  @IsString()
  comodato_contract_image_path?: string;
}
