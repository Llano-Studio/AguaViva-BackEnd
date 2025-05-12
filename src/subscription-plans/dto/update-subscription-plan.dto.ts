import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength, ValidateIf, IsNumber, Min, IsPositive } from 'class-validator';
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
} 