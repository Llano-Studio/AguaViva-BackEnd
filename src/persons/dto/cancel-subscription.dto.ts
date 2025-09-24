import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelSubscriptionDto {
  @ApiProperty({
    description: 'Fecha de cancelación de la suscripción (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsDateString()
  cancellation_date: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre la cancelación',
    example: 'Cliente solicitó cancelación por mudanza',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
