import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ReconcileRouteSheetDto {
  @ApiProperty({
    description: 'Firma digital del chofer como data URI base64',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAIA...', // Ejemplo
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^data:[^;]+;base64,.+$/, {
    message:
      'signature_data debe ser un data URI base64 (ej. "data:image/png;base64,...")',
  })
  signature_data: string;
}
