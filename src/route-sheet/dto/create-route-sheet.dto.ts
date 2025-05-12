import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRouteSheetDetailDto {
  @ApiProperty({
    description: 'ID del pedido que debe ser entregado',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  order_id: number;

  @ApiPropertyOptional({
    description: 'Estado inicial de la entrega (por defecto PENDING)',
    example: 'PENDING',
    default: 'PENDING'
  })
  @IsString()
  @IsOptional()
  delivery_status?: string = 'PENDING';

  @ApiPropertyOptional({
    description: 'Comentarios adicionales',
    example: 'Llamar al cliente antes de entregar'
  })
  @IsString()
  @IsOptional()
  comments?: string;
}

export class CreateRouteSheetDto {
  @ApiProperty({
    description: 'ID del conductor asignado',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  driver_id: number;

  @ApiProperty({
    description: 'ID del vehículo asignado',
    example: 1
  })
  @IsInt()
  @IsNotEmpty()
  vehicle_id: number;

  @ApiProperty({
    description: 'Fecha de entrega programada (YYYY-MM-DD)',
    example: '2023-07-15'
  })
  @IsDateString()
  @IsNotEmpty()
  delivery_date: string;

  @ApiPropertyOptional({
    description: 'Notas sobre la ruta',
    example: 'Ruta por zona norte'
  })
  @IsString()
  @IsOptional()
  route_notes?: string;

  @ApiProperty({
    description: 'Detalles de los pedidos a entregar',
    type: [CreateRouteSheetDetailDto]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRouteSheetDetailDto)
  details: CreateRouteSheetDetailDto[];
} 