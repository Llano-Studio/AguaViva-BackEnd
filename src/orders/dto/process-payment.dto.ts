import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessPaymentDto {
  @ApiProperty({
    description:
      'ID del método de pago utilizado (ej. 1 para Efectivo, 2 para QR)',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  payment_method_id: number;

  @ApiProperty({
    description: 'Monto del pago realizado',
    example: 150.5,
    type: Number,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description:
      'Referencia de la transacción (ej. ID de transacción de MercadoPago)',
    example: 'MP-123456789',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transaction_reference?: string;

  @ApiPropertyOptional({
    description:
      'Fecha y hora en que se realizó el pago (formato ISO 8601). Si no se provee, se usa la fecha y hora actual.',
    example: '2024-05-21T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el pago.',
    example: 'Pago parcial de orden híbrida',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
