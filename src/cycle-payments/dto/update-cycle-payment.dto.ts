import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNumber,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
  IsEnum,
} from 'class-validator';
import { PaymentMethod } from '../../common/constants/enums';

const stripDiacritics = (input: string) =>
  input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizePaymentMethod = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') {
    const mapById: Record<number, PaymentMethod> = {
      1: PaymentMethod.EFECTIVO,
      2: PaymentMethod.TRANSFERENCIA,
      3: PaymentMethod.TARJETA_DEBITO,
      4: PaymentMethod.TARJETA_CREDITO,
      5: PaymentMethod.CHEQUE,
      6: PaymentMethod.MOBILE_PAYMENT,
    };
    return mapById[value] ?? value;
  }
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  if (/^\d+$/.test(trimmed)) {
    return normalizePaymentMethod(parseInt(trimmed, 10));
  }

  const allValues = Object.values(PaymentMethod) as string[];
  if (allValues.includes(trimmed)) return trimmed;

  const normalized = stripDiacritics(trimmed)
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  const map: Record<string, PaymentMethod> = {
    EFECTIVO: PaymentMethod.EFECTIVO,
    CASH: PaymentMethod.EFECTIVO,
    EFECTIVO_AR: PaymentMethod.EFECTIVO,
    TRANSFERENCIA: PaymentMethod.TRANSFERENCIA,
    TRANSFERENCIA_BANCARIA: PaymentMethod.TRANSFERENCIA,
    BANK_TRANSFER: PaymentMethod.TRANSFERENCIA,
    TRANSFER: PaymentMethod.TRANSFERENCIA,
    TARJETA_DEBITO: PaymentMethod.TARJETA_DEBITO,
    DEBIT_CARD: PaymentMethod.TARJETA_DEBITO,
    DEBITO: PaymentMethod.TARJETA_DEBITO,
    TARJETA_CREDITO: PaymentMethod.TARJETA_CREDITO,
    CREDIT_CARD: PaymentMethod.TARJETA_CREDITO,
    CREDITO: PaymentMethod.TARJETA_CREDITO,
    CHEQUE: PaymentMethod.CHEQUE,
    MOBILE_PAYMENT: PaymentMethod.MOBILE_PAYMENT,
    QR: PaymentMethod.MOBILE_PAYMENT,
  };

  return map[normalized] ?? trimmed;
};

export class UpdateCyclePaymentDto {
  @ApiProperty({
    description: 'Nuevo monto del pago',
    example: 25000.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiProperty({
    description: 'Método de pago actualizado',
    example: PaymentMethod.TRANSFERENCIA,
    enum: PaymentMethod,
  })
  @Transform(({ value }) => normalizePaymentMethod(value))
  @IsEnum(PaymentMethod, {
    message:
      'El método de pago debe ser uno de los valores válidos del enum PaymentMethod',
  })
  payment_method: PaymentMethod;

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
