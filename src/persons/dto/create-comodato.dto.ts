import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ComodatoStatus } from '@prisma/client';

export class CreateComodatoDto {
  @ApiProperty({ example: 1, description: 'ID de la persona/cliente' })
  @IsInt()
  @IsNotEmpty()
  person_id: number;

  @ApiProperty({ example: 1, description: 'ID del producto en comodato' })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID de la suscripción asociada',
  })
  @IsInt()
  @IsOptional()
  subscription_id?: number;

  @ApiProperty({
    example: 2,
    description: 'Cantidad actual de productos en comodato',
  })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({
    example: 7,
    description: 'Cantidad máxima permitida según la suscripción',
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  max_quantity?: number;

  @ApiProperty({
    example: '2025-01-15',
    description: 'Fecha de entrega del comodato',
  })
  @IsDateString()
  @IsNotEmpty()
  delivery_date: string;

  @ApiPropertyOptional({
    example: '2025-12-15',
    description: 'Fecha esperada de devolución',
  })
  @IsDateString()
  @IsOptional()
  expected_return_date?: string;

  @ApiProperty({
    example: 'ACTIVE',
    enum: ComodatoStatus,
    description: 'Estado del comodato',
  })
  @IsEnum(ComodatoStatus)
  @IsNotEmpty()
  status: ComodatoStatus;

  @ApiPropertyOptional({
    example: 'Comodato de bidones para cliente nuevo',
    description: 'Notas adicionales',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: 5000.0,
    description: 'Monto del depósito en garantía',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  deposit_amount?: number;

  @ApiPropertyOptional({
    example: 500.0,
    description: 'Cuota mensual del comodato',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  monthly_fee?: number;

  @ApiPropertyOptional({
    example: 'Dispensador de agua fría/caliente',
    description: 'Descripción del artículo en comodato',
  })
  @IsString()
  @IsOptional()
  article_description?: string;

  @ApiPropertyOptional({
    example: 'Samsung',
    description: 'Marca del producto en comodato',
  })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    example: 'WD-500X',
    description: 'Modelo del producto en comodato',
  })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({
    example: '/uploads/contracts/comodato_123_contract.jpg',
    description: 'Ruta de la imagen del contrato',
  })
  @IsString()
  @IsOptional()
  contract_image_path?: string;
}
