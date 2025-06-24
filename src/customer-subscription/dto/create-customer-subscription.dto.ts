import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsDateString, IsEnum, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '@prisma/client';
import { DeliveryPreferences } from './customer-subscription-response.dto';

export class CreateCustomerSubscriptionDto {
  @ApiProperty({
    description: 'ID del cliente que se suscribe',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  customer_id: number;

  @ApiProperty({
    description: 'ID del plan de suscripción',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  subscription_plan_id: number;



  @ApiProperty({
    description: 'Fecha de inicio de la suscripción (YYYY-MM-DD)',
    example: '2024-01-01'
  })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin de la suscripción (YYYY-MM-DD), opcional',
    example: '2024-12-31'
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({
    description: 'Estado inicial de la suscripción',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE
  })
  @IsEnum(SubscriptionStatus)
  @IsNotEmpty()
  status: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre la suscripción',
    example: 'Suscripción creada por promoción especial'
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ 
    type: DeliveryPreferences,
    description: 'Preferencias de horario de entrega',
    required: false 
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryPreferences)
  delivery_preferences?: DeliveryPreferences;
} 