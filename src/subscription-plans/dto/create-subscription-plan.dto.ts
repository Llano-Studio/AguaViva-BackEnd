import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, ValidateIf, IsNumber, Min, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Plan Básico Mensual', description: 'Nombre del plan de suscripción', maxLength: 50 })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: 'Incluye acceso a funciones básicas.', description: 'Descripción del plan (opcional)', required: false, nullable: true })
  @IsOptional()
  @IsString()
  @ValidateIf((o, v) => v !== null || v === undefined) // Permite string, null, o undefined
  description?: string | null;

  @ApiProperty({ 
    example: 18300.00, 
    description: 'Precio fijo mensual del plan (opcional)', 
    required: false,
    type: Number 
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0) // Permitir precio 0 si es necesario (ej. plan gratuito)
  @Type(() => Number) // Transformar a número para validación
  price?: number;
} 