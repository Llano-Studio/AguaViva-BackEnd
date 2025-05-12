import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';

export enum EvidenceType {
  SIGNATURE = 'SIGNATURE',
  PHOTO = 'PHOTO',
  DOCUMENT = 'DOCUMENT'
}

export class CreateDeliveryEvidenceDto {
  @ApiProperty({
    description: 'ID del detalle de la hoja de ruta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  route_sheet_detail_id: number;

  @ApiProperty({
    description: 'Tipo de evidencia',
    enum: EvidenceType,
    example: 'SIGNATURE'
  })
  @IsEnum(EvidenceType)
  @IsNotEmpty()
  evidence_type: EvidenceType;

  @ApiPropertyOptional({
    description: 'ID del usuario que crea la evidencia (conductor)',
    example: 1
  })
  @IsInt()
  @IsOptional()
  created_by?: number;

  @ApiPropertyOptional({
    description: 'Datos adicionales de la evidencia (por ejemplo, base64 de firma o imagen)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAAN...'
  })
  @IsString()
  @IsOptional()
  evidence_data?: string;
}

export class DeliveryEvidenceResponseDto {
  @ApiProperty({
    description: 'ID de la evidencia',
    example: 1
  })
  evidence_id: number;

  @ApiProperty({
    description: 'ID del detalle de la hoja de ruta',
    example: 1
  })
  route_sheet_detail_id: number;

  @ApiProperty({
    description: 'Tipo de evidencia',
    enum: EvidenceType,
    example: 'SIGNATURE'
  })
  evidence_type: EvidenceType;

  @ApiProperty({
    description: 'Ruta del archivo',
    example: '/uploads/evidence/signature_123_456.png'
  })
  file_path: string;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2023-08-15T14:30:00Z'
  })
  created_at: string;

  @ApiProperty({
    description: 'ID del usuario que creó la evidencia',
    example: 1
  })
  created_by: number;

  constructor(partial: Partial<DeliveryEvidenceResponseDto>) {
    Object.assign(this, partial);
  }
} 