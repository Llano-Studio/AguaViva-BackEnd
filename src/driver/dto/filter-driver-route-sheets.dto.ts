import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class FilterDriverRouteSheetsDto {
  @ApiPropertyOptional({
    description:
      'Fecha de reparto (YYYY-MM-DD, hora de Buenos Aires). Por defecto, hoy.',
    example: '2026-10-12',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date debe tener formato YYYY-MM-DD',
  })
  date?: string;
}
