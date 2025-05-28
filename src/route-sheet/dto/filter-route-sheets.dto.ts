import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterRouteSheetsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'ID del conductor',
    example: 1
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  driver_id?: number;

  @ApiPropertyOptional({
    description: 'ID del vehículo',
    example: 1
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  vehicle_id?: number;

  @ApiPropertyOptional({
    description: 'Fecha desde (YYYY-MM-DD)',
    example: '2023-07-01'
  })
  @IsDateString()
  @IsOptional()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Fecha hasta (YYYY-MM-DD)',
    example: '2023-07-31'
  })
  @IsDateString()
  @IsOptional()
  to_date?: string;
} 