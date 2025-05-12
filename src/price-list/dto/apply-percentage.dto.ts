import { IsNotEmpty, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyPercentageDto {
  @ApiProperty({
    description: 'El porcentaje a aplicar a los precios de los ítems de la lista. E.g., 10 para un aumento del 10%, -5 para una disminución del 5%.',
    example: 10,
  })
  @IsNumber()
  @IsNotEmpty()
  percentage: number;
} 