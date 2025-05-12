import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class AdjustAllPlansPriceDto {
  @ApiProperty({
    description: 'Porcentaje de cambio a aplicar a los precios de todos los planes de suscripción. Ej: 10 para un aumento del 10%, -5 para una disminución del 5%.',
    example: 10.5,
  })
  @IsNumber()
  @IsNotEmpty()
  percentage_change: number;
} 