import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DeliveryTimeValidationDto {
  @ApiProperty({
    description: 'ID del pedido a validar',
    example: 101,
  })
  @IsInt()
  @IsNotEmpty()
  order_id: number;

  @ApiProperty({
    description: 'Horario de entrega propuesto en formato ISO',
    example: '2024-01-15T14:30:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  proposed_delivery_time: string;
}

export class ValidateDeliveryTimesDto {
  @ApiProperty({
    description: 'Lista de entregas a validar',
    type: [DeliveryTimeValidationDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryTimeValidationDto)
  deliveries: DeliveryTimeValidationDto[];
}

export class DeliveryTimeValidationResponseDto {
  @ApiProperty({
    description: 'ID del pedido',
    example: 101,
  })
  order_id: number;

  @ApiProperty({
    description: 'Nombre del cliente',
    example: 'Marcos López',
  })
  customer_name: string;

  @ApiProperty({
    description: 'Indica si el horario es válido según las preferencias',
    example: true,
  })
  is_valid: boolean;

  @ApiProperty({
    description: 'Mensaje de validación',
    example: 'Horario válido dentro del rango preferido',
    required: false,
  })
  message?: string;

  @ApiProperty({
    description: 'Horario sugerido si el propuesto no es válido',
    example: '14:00',
    required: false,
  })
  suggested_time?: string;

  @ApiProperty({
    description: 'Horarios preferidos del cliente',
    type: 'array',
    required: false,
  })
  preferred_schedules?: any[];
}
