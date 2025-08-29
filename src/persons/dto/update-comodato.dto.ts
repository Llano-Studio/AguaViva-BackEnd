import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ComodatoStatus } from '@prisma/client';

export class UpdateComodatoDto {
  @ApiPropertyOptional({ example: 3, description: 'Nueva cantidad de productos en comodato' })
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number;

  @ApiPropertyOptional({ example: '2025-02-15', description: 'Nueva fecha de entrega del comodato' })
  @IsDateString()
  @IsOptional()
  delivery_date?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Nueva fecha esperada de devolución' })
  @IsDateString()
  @IsOptional()
  expected_return_date?: string;

  @ApiPropertyOptional({ example: '2025-01-20', description: 'Fecha real de devolución' })
  @IsDateString()
  @IsOptional()
  actual_return_date?: string;

  @ApiPropertyOptional({ 
    example: 'RETURNED', 
    enum: ComodatoStatus, 
    description: 'Nuevo estado del comodato' 
  })
  @IsEnum(ComodatoStatus)
  @IsOptional()
  status?: ComodatoStatus;

  @ApiPropertyOptional({ example: 'Cliente devolvió los bidones en buen estado', description: 'Nuevas notas' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: 6000.00, description: 'Nuevo monto del depósito' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  deposit_amount?: number;

  @ApiPropertyOptional({ example: 600.00, description: 'Nueva cuota mensual' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  monthly_fee?: number;

  @ApiPropertyOptional({ example: 'Dispensador de agua fría/caliente actualizado', description: 'Nueva descripción del artículo' })
  @IsString()
  @IsOptional()
  article_description?: string;

  @ApiPropertyOptional({ example: 'LG', description: 'Nueva marca del producto' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ example: 'WD-600Y', description: 'Nuevo modelo del producto' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ example: '/uploads/contracts/comodato_123_contract_updated.jpg', description: 'Nueva ruta de imagen del contrato' })
  @IsString()
  @IsOptional()
  contract_image_path?: string;
}