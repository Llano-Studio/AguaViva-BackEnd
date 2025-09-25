import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '@prisma/client';
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
