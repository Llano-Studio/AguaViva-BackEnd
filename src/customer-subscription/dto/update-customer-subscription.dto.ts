import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsInt, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '@prisma/client';
import { DeliveryPreferences } from './customer-subscription-response.dto';

export class UpdateCustomerSubscriptionDto {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  subscription_plan_id?: number;

  @ApiProperty({ example: '2024-12-31', required: false })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({ example: '2024-01-15', required: false })
  @IsOptional()
  @IsDateString()
  collection_date?: string;

  @ApiProperty({ 
    enum: SubscriptionStatus, 
    example: SubscriptionStatus.ACTIVE, 
    required: false 
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiProperty({ 
    example: 'Cliente VIP - entrega prioritaria', 
    required: false 
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