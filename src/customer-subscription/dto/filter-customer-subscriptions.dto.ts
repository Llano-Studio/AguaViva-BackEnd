import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SubscriptionStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterCustomerSubscriptionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Búsqueda general por nombre del cliente o notas de la suscripción',
    example: 'juan',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por ID del cliente (para compatibilidad)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  customer_id?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples IDs de clientes. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;

    if (typeof value === 'string') {
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  customer_ids?: number[];

  @ApiPropertyOptional({
    description: 'Filtrar por ID del plan de suscripción (para compatibilidad)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  subscription_plan_id?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples IDs de planes de suscripción. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;

    if (typeof value === 'string') {
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  subscription_plan_ids?: number[];

  @ApiPropertyOptional({
    description: 'Filtrar por estado de la suscripción (para compatibilidad)',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples estados de suscripción. Puede ser un array o string separado por comas "ACTIVE,PAUSED,CANCELLED"',
    example: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED],
    enum: SubscriptionStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;

    const validStatuses = Object.values(SubscriptionStatus);

    if (typeof value === 'string') {
      const statuses = value
        .split(',')
        .map((status) => status.trim())
        .filter((status) =>
          validStatuses.includes(status as SubscriptionStatus),
        );
      return statuses.length > 0 ? statuses : undefined;
    }
    if (Array.isArray(value)) {
      const statuses = value.filter((status) => validStatuses.includes(status));
      return statuses.length > 0 ? statuses : undefined;
    }
    return undefined;
  })
  statuses?: SubscriptionStatus[];

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

  // end_date filtering fields removed - not present in schema

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
