import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterCustomerSubscriptionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Búsqueda general por nombre del cliente o notas de la suscripción',
    example: 'juan',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del cliente',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  customer_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del plan de suscripción',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  subscription_plan_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la suscripción',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de inicio desde (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  start_date_from?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de inicio hasta (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  start_date_to?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de fin desde (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  end_date_from?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por fecha de fin hasta (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  end_date_to?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre del cliente (búsqueda parcial)',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por nombre del plan (búsqueda parcial)',
    example: 'Plan Básico',
  })
  @IsOptional()
  @IsString()
  plan_name?: string;

  @ApiPropertyOptional({
    description: 'Incluir solo suscripciones activas o no expiradas',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  only_active?: boolean;
} 