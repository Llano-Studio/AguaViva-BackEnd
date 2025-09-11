import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateStringFlexible } from '../../common/decorators/is-date-string-flexible.decorator';

export class CreateCancellationOrderDto {
  @ApiProperty({
    description: 'ID de la suscripción cancelada',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  subscription_id: number;

  @ApiProperty({
    description: 'Fecha programada para la recolección (YYYY-MM-DD)',
    example: '2024-12-25',
    format: 'date',
  })
  @IsDateStringFlexible()
  @IsNotEmpty()
  scheduled_collection_date: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Notas de la orden de cancelación',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}