import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  ValidateIf,
  IsNumber,
  Min,
  IsInt,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PersonType } from '../../common/constants/enums';

export class CreateSubscriptionPlanDto {
  @ApiProperty({
    example: 'Plan Básico Mensual',
    description: 'Nombre del plan de suscripción',
    maxLength: 50,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    example: 'Incluye acceso a funciones básicas.',
    description: 'Descripción del plan (opcional)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null || v === undefined) // Permite string, null, o undefined
  description?: string | null;

  @ApiPropertyOptional({
    example: 18300.0,
    description: 'Precio fijo mensual del plan (opcional)',
    required: false,
    type: Number,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0) // Permitir precio 0 si es necesario (ej. plan gratuito)
  @Type(() => Number) // Transformar a número para validación
  price?: number;

  @ApiPropertyOptional({
    description:
      'Duración por defecto del ciclo del plan en días (valor por defecto para nuevas suscripciones)',
    example: 30,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  default_cycle_days?: number;

  @ApiPropertyOptional({
    description:
      'Número por defecto de entregas por ciclo (valor por defecto para nuevas suscripciones)',
    example: 1,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  default_deliveries_per_cycle?: number;

  @ApiPropertyOptional({
    description:
      'Indica si el plan está activo y disponible para nuevas suscripciones',
    example: true,
    type: 'boolean',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    // Si ya es boolean, devolverlo tal como está
    if (typeof value === 'boolean') {
      return value;
    }

    // Si es string, convertir a boolean
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      return lowerValue === 'true' || lowerValue === '1';
    }

    // Si es number, convertir a boolean
    if (typeof value === 'number') {
      return value === 1;
    }

    // Para cualquier otro caso, devolver true por defecto en creación
    return true;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Tipo de plan de suscripción',
    enum: PersonType,
    example: PersonType.PLAN,
    default: PersonType.PLAN,
  })
  @IsOptional()
  @IsEnum(PersonType)
  type?: PersonType;
}
