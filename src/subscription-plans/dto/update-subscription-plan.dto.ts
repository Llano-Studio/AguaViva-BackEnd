import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, ValidateIf, IsNumber, Min, IsPositive, IsInt, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({ example: 'Plan Básico Renovado', description: 'Nuevo nombre del plan de suscripción', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'Descripción actualizada.', description: 'Nueva descripción del plan', nullable: true })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null || v === undefined) // Permite string, null o undefined
  description?: string | null;

  @ApiPropertyOptional({ 
    example: 19000.00, 
    description: 'Nuevo precio fijo mensual del plan', 
    required: false,
    type: Number 
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  price?: number;

  @ApiPropertyOptional({ description: 'Nueva duración del ciclo del plan en días', example: 30, type: 'integer' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  cycle_days?: number;

  @ApiPropertyOptional({ description: 'Nuevo número de entregas por ciclo', example: 1, type: 'integer' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  deliveries_per_cycle?: number;

  @ApiPropertyOptional({ description: 'Nuevo estado de activación del plan', example: true, type: 'boolean' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  active?: boolean;
} 