import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionDeliveryScheduleResponseDto {
  @ApiProperty({ example: 1 })
  schedule_id: number;

  @ApiProperty({ example: 1 })
  subscription_id: number;

  @ApiProperty({ 
    example: 1, 
    description: 'Día de la semana (1=Lunes, 2=Martes, ..., 7=Domingo)' 
  })
  day_of_week: number;

  @ApiProperty({ 
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
    description: 'Hora programada de entrega. Puede ser horario puntual (HH:MM) o rango horario (HH:MM-HH:MM)' 
  })
  scheduled_time: string;

  @ApiProperty({ 
    example: 'Lunes',
    description: 'Nombre del día de la semana' 
  })
  day_name?: string;

  @ApiProperty({
    example: 'puntual',
    description: 'Tipo de horario: "puntual" para hora específica, "rango" para período de tiempo',
    enum: ['puntual', 'rango']
  })
  schedule_type?: string;

  @ApiProperty({
    example: '09:30',
    description: 'Hora de inicio (para rangos) o hora específica (para puntuales)',
    required: false
  })
  start_time?: string;

  @ApiProperty({
    example: '12:00',
    description: 'Hora de fin (solo para rangos horarios)',
    required: false
  })
  end_time?: string;

  constructor(partial: Partial<any>) {
    Object.assign(this, partial);
    
    // Convert time to string if it's a Date (for backward compatibility)
    if (partial.scheduled_time instanceof Date) {
      this.scheduled_time = partial.scheduled_time.toTimeString().split(' ')[0].substring(0, 5);
    }
    
    // Add day name
    const dayNames = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    this.day_name = dayNames[this.day_of_week] || '';
    
    // Parse schedule type and times
    if (this.scheduled_time) {
      if (this.scheduled_time.includes('-')) {
        // Range format: "09:00-12:00"
        this.schedule_type = 'rango';
        const [start, end] = this.scheduled_time.split('-');
        this.start_time = start.trim();
        this.end_time = end.trim();
      } else {
        // Point format: "09:30"
        this.schedule_type = 'puntual';
        this.start_time = this.scheduled_time;
        this.end_time = undefined;
      }
    }
  }
} 