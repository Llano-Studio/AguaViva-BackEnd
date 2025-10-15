import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsString, IsOptional, IsDateString, Min, MaxLength, IsIn } from 'class-validator';

export class UpdateCyclePaymentDto {
  @ApiProperty({
    description: 'Nuevo monto del pago',
    example: 25000.00,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiProperty({
    description: 'Método de pago actualizado',
    example: 'TRANSFERENCIA',
    enum: ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CHEQUE'],
  })
  @IsString()
  @IsIn(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'CHEQUE'], {
    message: 'El método de pago debe ser uno de: EFECTIVO, TRANSFERENCIA, TARJETA_DEBITO, TARJETA_CREDITO, CHEQUE',
  })
  payment_method: string;

  @ApiPropertyOptional({
    description: 'Nueva fecha del pago (ISO 8601)',
    example: '2024-01-15T10:30:00.000Z',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe estar en formato ISO 8601' })
  payment_date?: string;

  @ApiPropertyOptional({
    description: 'Referencia actualizada del pago',
    example: 'TRANS-001234-UPDATED',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'La referencia no puede exceder 100 caracteres' })
  reference?: string;

  @ApiPropertyOptional({
    description: 'Notas actualizadas',
    example: 'Pago corregido por error en monto inicial',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Las notas no pueden exceder 500 caracteres' })
  notes?: string;
}