import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Motivo por el cual el chofer no puede completar la entrega de la parada. */
export enum DriverSkipReason {
  CLIENT_ABSENT = 'CLIENT_ABSENT',
  WRONG_ADDRESS = 'WRONG_ADDRESS',
  ACCESS_ISSUE = 'ACCESS_ISSUE',
  REJECTED_BY_CLIENT = 'REJECTED_BY_CLIENT',
  VEHICLE_ISSUE = 'VEHICLE_ISSUE',
  OTHER = 'OTHER',
}

export const DRIVER_SKIP_REASONS: DriverSkipReason[] = [
  DriverSkipReason.CLIENT_ABSENT,
  DriverSkipReason.WRONG_ADDRESS,
  DriverSkipReason.ACCESS_ISSUE,
  DriverSkipReason.REJECTED_BY_CLIENT,
  DriverSkipReason.VEHICLE_ISSUE,
  DriverSkipReason.OTHER,
];

/** Salto de una parada con motivo obligatorio. Queda auditado como incidente. */
export class SkipDeliveryDto {
  @ApiProperty({
    description: 'Motivo del salto. Es obligatorio y queda registrado.',
    enum: DriverSkipReason,
    example: DriverSkipReason.CLIENT_ABSENT,
  })
  @IsIn(DRIVER_SKIP_REASONS)
  reason: DriverSkipReason;

  @ApiPropertyOptional({
    description: 'Detalle adicional del motivo',
    example: 'El cliente no responde al timbre ni al teléfono.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Versión del detalle que el chofer tenía a la vista, para detectar datos obsoletos',
    example: '3f9a1c7d5b2e4a60',
  })
  @IsOptional()
  @IsString()
  version?: string;
}
