import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({
    example: 'Plan Básico Renovado',
    description: 'Nuevo nombre del plan de suscripción',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    example: 'Descripción actualizada.',
    description: 'Nueva descripción del plan',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null || v === undefined) // Permite string, null o undefined
  description?: string | null;

  @ApiPropertyOptional({
    example: 19000.0,
    description: 'Nuevo precio fijo mensual del plan',
    required: false,
    type: Number,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({
    description:
      'Nueva duración por defecto del ciclo del plan en días (valor por defecto para nuevas suscripciones)',
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
      'Nuevo número por defecto de entregas por ciclo (valor por defecto para nuevas suscripciones)',
    example: 1,
    type: 'integer',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  default_deliveries_per_cycle?: number;

  @ApiPropertyOptional({
    description: 'Nuevo estado de activación del plan',
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
      if (lowerValue === 'true' || lowerValue === '1') {
        return true;
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return false;
      }
    }
    
    // Si es number, convertir a boolean
    if (typeof value === 'number') {
      return value === 1;
    }
    
    // Para cualquier otro caso (null, undefined, etc.), devolver undefined
    // para que el campo sea opcional y no se actualice si no se envía
    return undefined;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Nuevo tipo de plan de suscripción',
    enum: PersonType,
    example: PersonType.PLAN,
  })
  @IsOptional()
  @IsEnum(PersonType)
  type?: PersonType;
}
