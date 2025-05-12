import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsOptional, IsEnum, Matches } from 'class-validator';

// Ejemplo de enum para los motivos, podría definirse en un archivo de enums global o aquí mismo.
export enum SkipDeliveryReason {
  CLIENT_ABSENT = 'CLIENT_ABSENT',
  WRONG_ADDRESS = 'WRONG_ADDRESS',
  ACCESS_ISSUE = 'ACCESS_ISSUE',
  REJECTED_BY_CLIENT = 'REJECTED_BY_CLIENT',
  VEHICLE_ISSUE = 'VEHICLE_ISSUE',
  OTHER = 'OTHER',
}

export class SkipDeliveryDto {
  @ApiProperty({
    description: 'Motivo por el cual se salta la entrega.',
    example: SkipDeliveryReason.CLIENT_ABSENT,
    enum: SkipDeliveryReason,
  })
  @IsNotEmpty()
  @IsEnum(SkipDeliveryReason, { message: `El motivo debe ser uno de los valores permitidos: ${Object.values(SkipDeliveryReason).join(', ')}` })
  reason: SkipDeliveryReason;

  @ApiPropertyOptional({
    description: 'Notas adicionales o explicación del motivo.',
    example: 'El cliente no responde al timbre ni al teléfono.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Foto de evidencia en formato base64 Data URI (ej. data:image/jpeg;base64,...)',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...',
  })
  @IsOptional()
  @IsString()
  @Matches(/^data:image\/(jpeg|png|gif|bmp);base64,([A-Za-z0-9+/]+={0,2})$/, {
    message: 'photo_data_uri debe ser un Data URI de imagen base64 válido (jpeg, png, gif, bmp).',
  })
  photo_data_uri?: string;
} 