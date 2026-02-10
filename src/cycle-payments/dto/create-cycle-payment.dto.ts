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
  if (typeof value === 'object') {
    const v = (value as any)?.key ?? (value as any)?.value;
    if (typeof v === 'string') return normalizePaymentMethod(v);
    if (typeof v === 'number') return normalizePaymentMethod(v);
    return value;
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
    MERCADO_PAGO: PaymentMethod.MOBILE_PAYMENT,
    MERCADOPAGO: PaymentMethod.MOBILE_PAYMENT,
    TARJETA: PaymentMethod.TARJETA_CREDITO,
  };

  return map[normalized] ?? trimmed;
};

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
  @Transform(({ value }) => normalizePaymentMethod(value))
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
