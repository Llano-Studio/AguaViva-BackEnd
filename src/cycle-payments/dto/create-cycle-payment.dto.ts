import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaymentMethod } from '../../common/constants/enums';

export class CreateCyclePaymentDto {
  @ApiProperty({
    description: 'ID del ciclo de suscripción al que se aplica el pago',
    example: 1,
    type: 'integer',
  })
  @IsNotEmpty()
  @IsNumber()
  cycle_id: number;

  @ApiProperty({
    description:
      'Monto del pago (se permiten sobrepagos que se acreditarán como crédito)',
    example: 15000.0,
    type: 'number',
    format: 'float',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  // NOTA: NO se aplica @Max para permitir sobrepagos
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiProperty({
    description: 'Método de pago utilizado',
    example: PaymentMethod.EFECTIVO,
    enum: PaymentMethod,
  })
  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  payment_method: PaymentMethod;

  @ApiPropertyOptional({
    description:
      'Fecha del pago (si no se proporciona, se usa la fecha actual)',
    example: '2024-01-15T10:30:00.000Z',
    type: 'string',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @ApiPropertyOptional({
    description:
      'Referencia del pago (número de comprobante, transferencia, etc.)',
    example: 'TRANS-001234',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el pago',
    example: 'Pago correspondiente al ciclo de enero 2024',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
