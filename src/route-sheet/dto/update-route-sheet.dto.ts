import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRouteSheetDetailDto } from './create-route-sheet.dto';

export class UpdateRouteSheetDetailDto extends CreateRouteSheetDetailDto {
  @ApiPropertyOptional({
    description: 'ID del detalle de hoja de ruta a actualizar',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  route_sheet_detail_id?: number;
}

export class UpdateRouteSheetDto {
  @ApiPropertyOptional({
    description: 'ID del conductor asignado',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  driver_id?: number;

  @ApiPropertyOptional({
    description: 'ID del vehículo asignado',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  vehicle_id?: number;

  @ApiPropertyOptional({
    description: 'Fecha de entrega programada (YYYY-MM-DD)',
    example: '2023-07-15',
  })
  @IsDateString()
  @IsOptional()
  delivery_date?: string;

  @ApiPropertyOptional({
    description: 'Notas sobre la ruta',
    example: 'Ruta por zona norte',
  })
  @IsString()
  @IsOptional()
  route_notes?: string;

  @ApiPropertyOptional({
    description: 'Detalles de los pedidos a entregar',
    type: [UpdateRouteSheetDetailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRouteSheetDetailDto)
  @IsOptional()
  details?: UpdateRouteSheetDetailDto[];
}
