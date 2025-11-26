import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsDateString } from 'class-validator';

export class GenerateCollectionPdfDto {
  @ApiProperty({
    description: 'Incluir campo de firma en el PDF',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeSignatureField?: boolean = true;

  @ApiProperty({
    description: 'Fecha específica para filtrar cobranzas (opcional)',
    example: '2024-01-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  filterDate?: string;

  @ApiProperty({
    description: 'Notas adicionales para incluir en el PDF',
    example: 'Ruta especial de cobranzas automáticas',
    required: false,
  })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}

export class CollectionPdfResponseDto {
  @ApiProperty({
    description: 'URL del PDF generado',
    example: '/public/pdfs/collection_route_sheet_123_2024-01-15.pdf',
  })
  url: string;

  @ApiProperty({
    description: 'Nombre del archivo PDF',
    example: 'collection_route_sheet_123_2024-01-15.pdf',
  })
  filename: string;

  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 123,
  })
  route_sheet_id: number;

  @ApiProperty({
    description: 'Fecha de generación del PDF',
    example: '2024-01-15T10:30:00Z',
  })
  generated_at: string;

  @ApiProperty({
    description: 'Número total de cobranzas incluidas en el PDF',
    example: 15,
  })
  total_collections: number;
}
