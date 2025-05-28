import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { PersonType } from '../../common/constants/enums';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterPersonsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por ID de la persona',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  personId?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre de la persona (búsqueda parcial)',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por dirección de la persona (búsqueda parcial)',
    example: 'Calle Falsa 123',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de persona',
    enum: PersonType,
    example: PersonType.INDIVIDUAL,
  })
  @IsOptional()
  @IsEnum(PersonType)
  type?: PersonType;

  @ApiPropertyOptional({
    description: 'Filtrar por número de teléfono (búsqueda parcial)',
    example: '1134567890',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por CUIT/CUIL/DNI (búsqueda parcial)',
    example: '20123456789',
  })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de localidad',
    example: 101,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  localityId?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID de zona',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  zoneId?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por estado del semáforo de pagos del cliente.',
    example: 'YELLOW',
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED']
  })
  @IsOptional()
  @IsString()
  @IsEnum(['NONE', 'GREEN', 'YELLOW', 'RED'], { message: 'El estado del semáforo debe ser NONE, GREEN, YELLOW o RED' })
  payment_semaphore_status?: string;
} 