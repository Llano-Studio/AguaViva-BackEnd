import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRouteSheetDetailDto } from './create-route-sheet.dto';
import { SkipDeliveryReason } from './skip-delivery.dto';

/**
 * Inserción incremental de paradas en una hoja de ruta existente.
 * No borra ni recrea detalles: preserva los IDs ya existentes.
 */
export class AddRouteSheetDetailsDto {
  @ApiProperty({
    description: 'Paradas a agregar a la hoja de ruta existente.',
    type: [CreateRouteSheetDetailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRouteSheetDetailDto)
  details: CreateRouteSheetDetailDto[];
}

/** Reprogramación de una parada no entregada a una nueva fecha. */
export class RescheduleDeliveryDto {
  @ApiProperty({
    description: 'Nueva fecha de entrega (YYYY-MM-DD).',
    example: '2023-07-20',
  })
  @IsDateString()
  @IsNotEmpty()
  reschedule_date: string;

  @ApiProperty({
    description: 'Motivo por el cual se reprograma la entrega.',
    enum: SkipDeliveryReason,
    example: SkipDeliveryReason.CLIENT_ABSENT,
  })
  @IsEnum(SkipDeliveryReason)
  reason: SkipDeliveryReason;

  @ApiPropertyOptional({
    description: 'Notas adicionales de la reprogramación.',
    example: 'El cliente pidió pasar el jueves.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Derivación de una parada no entregada a resolución administrativa. */
export class ForwardDeliveryToAdminDto {
  @ApiProperty({
    description: 'Motivo por el cual se deriva la parada al administrador.',
    enum: SkipDeliveryReason,
    example: SkipDeliveryReason.WRONG_ADDRESS,
  })
  @IsEnum(SkipDeliveryReason)
  reason: SkipDeliveryReason;

  @ApiPropertyOptional({
    description: 'Notas adicionales para el administrador.',
    example: 'La dirección no existe, requiere verificación.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Resultado de reprogramar o derivar una parada no entregada. */
export class DeliveryResolutionResultDto {
  @ApiProperty({ description: 'ID de la parada resuelta', example: 101 })
  @IsInt()
  detail_id: number;

  @ApiPropertyOptional({
    description:
      'ID de la hoja de ruta destino (solo en reprogramación con parada creada).',
    example: 42,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  target_route_sheet_id?: number | null;

  @ApiPropertyOptional({
    description: 'ID de la parada creada en la hoja destino.',
    example: 315,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  target_detail_id?: number | null;

  @ApiPropertyOptional({
    description: 'Nueva fecha de entrega aplicada (YYYY-MM-DD).',
    example: '2023-07-20',
  })
  @IsOptional()
  @IsDateString()
  reschedule_date?: string;

  @ApiProperty({
    description:
      'true cuando la operación ya había sido aplicada y no se volvió a ejecutar.',
    example: false,
  })
  @IsBoolean()
  idempotent_replay: boolean;
}
