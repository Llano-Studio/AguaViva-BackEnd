import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBase64 } from 'class-validator';

export class ReconcileRouteSheetDto {
  @ApiProperty({
    description: 'Firma digital del chofer en formato base64',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABAAAAAIA...', // Ejemplo
  })
  @IsString()
  @IsNotEmpty()
  @IsBase64()
  signature_data: string;
} 