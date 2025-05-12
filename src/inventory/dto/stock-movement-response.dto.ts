import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { CreateStockMovementDto } from './create-stock-movement.dto';

export class StockMovementResponseDto extends CreateStockMovementDto {
  @ApiProperty({ example: 1, description: 'ID del movimiento de stock registrado' })
  @IsInt()
  stock_movement_id: number;

} 