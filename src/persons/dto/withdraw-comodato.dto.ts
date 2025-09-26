import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class WithdrawComodatoDto {
  @ApiProperty({
    description: 'ID del comodato a retirar',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  @Type(() => Number)
  comodato_id: number;

  @ApiPropertyOptional({
    description: 'Fecha programada para el retiro (YYYY-MM-DD). Si no se especifica, se programa para 7 días después',
    example: '2024-01-20',
  })
  @IsOptional()
  @IsDateString()
  scheduled_withdrawal_date?: string;

  @ApiPropertyOptional({
    description: 'Motivo del retiro del comodato',
    example: 'Cliente solicita cambio de producto',
  })
  @IsOptional()
  @IsString()
  withdrawal_reason?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales sobre el retiro',
    example: 'Coordinar con cliente para horario de retiro',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Indica si se debe crear automáticamente una orden de recuperación',
    example: true,
    default: true,
  })
  @IsOptional()
  create_recovery_order?: boolean = true;
}