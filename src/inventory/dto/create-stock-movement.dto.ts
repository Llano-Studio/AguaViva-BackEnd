import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive, IsDate, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStockMovementDto {
  @ApiProperty({
    example: '2024-07-30T10:00:00.000Z',
    description: 'Fecha y hora del movimiento (opcional, por defecto es la fecha actual)',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  movement_date?: Date;

  @ApiProperty({ example: 1, description: 'ID del tipo de movimiento' })
  @IsInt()
  movement_type_id: number;

  @ApiProperty({ example: 1, description: 'ID del producto' })
  @IsInt()
  product_id: number;

  @ApiProperty({ example: 10, description: 'Cantidad del movimiento (debe ser positiva)' })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({
    example: 1,
    description: 'ID del almacén de origen (requerido para salidas o transferencias)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @ValidateIf((o, v) => v !== null)
  source_warehouse_id?: number | null;

  @ApiProperty({
    example: 2,
    description: 'ID del almacén de destino (requerido para entradas o transferencias)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @ValidateIf((o, v) => v !== null)
  destination_warehouse_id?: number | null;

  @ApiProperty({
    example: 'Ajuste inicial de stock.',
    description: 'Observaciones sobre el movimiento (opcional)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @ValidateIf((o, v) => v !== null)
  remarks?: string | null;
} 