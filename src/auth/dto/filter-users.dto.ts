import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Buscar por nombre o correo electrónico',
    example: 'Juan'
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por rol (para compatibilidad)',
    enum: Role
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Filtrar por roles múltiples. Puede ser un array o string separado por comas "SUPERADMIN,ADMINISTRATIVE"',
    example: [Role.SUPERADMIN, Role.ADMINISTRATIVE],
    enum: Role,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      const roles = value.split(',').map(role => role.trim()).filter(role => Object.values(Role).includes(role as Role));
      return roles.length > 0 ? roles : undefined;
    }
    if (Array.isArray(value)) {
      const roles = value.filter(role => Object.values(Role).includes(role));
      return roles.length > 0 ? roles : undefined;
    }
    return undefined;
  })
  roles?: Role[];

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo/inactivo',
    example: true
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
} 