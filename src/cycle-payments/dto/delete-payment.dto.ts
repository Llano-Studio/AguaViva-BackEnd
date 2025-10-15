import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class DeletePaymentDto {
  @ApiProperty({
    description: 'Código de confirmación de seguridad',
    example: 'CONFIRM123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'El código de confirmación debe tener al menos 6 caracteres' })
  confirmation_code: string;

  @ApiProperty({
    description: 'Motivo de la eliminación',
    example: 'Pago duplicado registrado por error',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(500, { message: 'El motivo no puede exceder 500 caracteres' })
  reason: string;
}