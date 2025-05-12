import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PrintRouteSheetDto {
  @ApiProperty({
    description: 'ID de la hoja de ruta',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  route_sheet_id: number;

  @ApiPropertyOptional({
    description: 'Formato de salida (pdf o html)',
    example: 'pdf',
    default: 'pdf'
  })
  @IsString()
  @IsOptional()
  format?: string = 'pdf';

  @ApiPropertyOptional({
    description: 'Incluir mapa de la ruta',
    example: true,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  include_map?: boolean = false;

  @ApiPropertyOptional({
    description: 'Incluir sección para firma',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  include_signature_field?: boolean = true;

  @ApiPropertyOptional({
    description: 'Incluir detalles de productos',
    example: true,
    default: true
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  include_product_details?: boolean = true;
} 