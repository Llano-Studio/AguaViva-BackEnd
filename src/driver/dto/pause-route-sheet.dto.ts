import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RouteSheetPauseReason } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class PauseRouteSheetDto {
  @ApiProperty({
    description: 'Motivo de la pausa',
    enum: RouteSheetPauseReason,
    example: RouteSheetPauseReason.RESTOCK,
  })
  @IsEnum(RouteSheetPauseReason, {
    message: `El motivo debe ser uno de: ${Object.values(RouteSheetPauseReason).join(', ')}`,
  })
  reason: RouteSheetPauseReason;

  @ApiPropertyOptional({
    description: 'Detalle de la pausa. Obligatorio cuando el motivo es OTHER.',
    example: 'Vuelvo al depósito a cargar 20 bidones',
  })
  @ValidateIf(
    (dto: PauseRouteSheetDto) =>
      dto.reason === RouteSheetPauseReason.OTHER || dto.notes !== undefined,
  )
  @IsString()
  @IsNotEmpty({ message: 'Las notas son obligatorias cuando el motivo es OTHER' })
  @MaxLength(500)
  notes?: string;
}
