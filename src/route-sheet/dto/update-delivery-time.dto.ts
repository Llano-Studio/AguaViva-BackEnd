import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateDeliveryTimeDto {
  @ApiProperty({
    description: 'Horario de entrega programado. Puede ser un horario específico (HH:MM) o un rango (HH:MM-HH:MM)',
    example: '08:00-16:00'
  })
  @IsString()
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