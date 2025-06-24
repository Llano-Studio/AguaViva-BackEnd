import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsNotEmpty, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubscriptionDeliveryScheduleDto {
  @ApiProperty({
    description: 'ID de la suscripción',
    example: 1
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  subscription_id: number;

  @ApiProperty({
    description: 'Día de la semana (1=Lunes, 2=Martes, ..., 7=Domingo)',
    example: 1,
    minimum: 1,
    maximum: 7
  })
  @IsInt()
  @Min(1)
  @Max(7)
  @Type(() => Number)
  day_of_week: number;

  @ApiProperty({
    description: 'Hora programada de entrega. Soporta horario puntual (HH:MM) o rango horario (HH:MM-HH:MM)',
    examples: {
      puntual: {
        summary: 'Horario puntual',
        value: '09:30'
      },
      rango: {
        summary: 'Rango horario',
        value: '09:00-12:00'
      }
    },
    example: '09:30'
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](-([0-1]?[0-9]|2[0-3]):[0-5][0-9])?$/, {
    message: 'scheduled_time debe estar en formato HH:MM para horario puntual o HH:MM-HH:MM para rango horario'
  })
  scheduled_time: string;
} 