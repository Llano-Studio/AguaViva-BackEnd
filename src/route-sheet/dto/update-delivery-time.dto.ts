import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDeliveryTimeDto {
  @ApiProperty({
    description: 'Nuevo horario de entrega programado (formato ISO)',
    example: '2024-01-15T14:30:00Z'
  })
  @IsDateString()
  @IsNotEmpty()
  delivery_time: string;

  @ApiPropertyOptional({
    description: 'Comentarios adicionales sobre el cambio de horario',
    example: 'Cliente solicitó cambio de horario'
  })
  @IsString()
  @IsOptional()
  comments?: string;
} 