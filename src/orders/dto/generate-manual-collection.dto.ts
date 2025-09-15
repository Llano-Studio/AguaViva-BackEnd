import { IsNotEmpty, IsNumber, IsString, IsArray, IsOptional, IsDateString, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateManualCollectionDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 1
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  customer_id: number;

  @ApiProperty({
    description: 'IDs de ciclos seleccionados',
    example: [45, 46, 47],
    type: [Number]
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsNumber({}, { each: true })
  selected_cycles: number[];

  @ApiProperty({
    description: 'Fecha del pedido (YYYY-MM-DD)',
    example: '2024-01-20'
  })
  @IsNotEmpty()
  @IsDateString()
  collection_date: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Cobranza manual generada por solicitud especial'
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateManualCollectionResponseDto {
  @ApiProperty({
    description: 'Estado de la operación',
    example: true
  })
  success: boolean;

  @ApiProperty({
    description: 'ID del pedido generado/actualizado',
    example: 123
  })
  order_id: number;

  @ApiProperty({
    description: 'Acción realizada',
    example: 'created',
    enum: ['created', 'updated']
  })
  action: string;

  @ApiProperty({
    description: 'Monto total de la cobranza',
    example: 500.00
  })
  total_amount: number;

  @ApiProperty({
    description: 'Cantidad de ciclos procesados',
    example: 2
  })
  cycles_processed: number;

  @ApiProperty({
    description: 'Mensaje de resultado',
    example: 'Pedido de cobranza generado exitosamente'
  })
  message: string;
}

export class ExistingOrderInfoDto {
  @ApiProperty({
    description: 'ID del pedido existente',
    example: 123
  })
  order_id: number;

  @ApiProperty({
    description: 'Fecha del pedido',
    example: '2024-01-20T10:00:00Z'
  })
  order_date: string;

  @ApiProperty({
    description: 'Monto total del pedido',
    example: 300.00
  })
  total_amount: number;

  @ApiProperty({
    description: 'Estado del pedido',
    example: 'PENDING'
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Notas del pedido',
    example: 'Pedido generado automáticamente'
  })
  notes?: string;
}

export class ExistingOrderResponseDto {
  @ApiProperty({
    description: 'Si existe pedido en la fecha',
    example: true
  })
  has_existing_order: boolean;

  @ApiPropertyOptional({
    description: 'Información del pedido existente',
    type: ExistingOrderInfoDto
  })
  order_info?: ExistingOrderInfoDto;
}