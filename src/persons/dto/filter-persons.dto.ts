import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { PersonType } from '../../common/constants/enums';
import { Type, Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class FilterPersonsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Búsqueda general por nombre, alias, dirección, teléfono o CUIT/CUIL/DNI',
    example: 'marcos',
  })
  @IsOptional()
  @IsString()
  search?: string;

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
    description: 'Filtrar por alias de la persona (búsqueda parcial)',
    example: 'Juancho',
  })
  @IsOptional()
  @IsString()
  alias?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por dirección de la persona (búsqueda parcial)',
    example: 'Calle Falsa 123',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de persona (para compatibilidad)',
    enum: PersonType,
    example: PersonType.INDIVIDUAL,
  })
  @IsOptional()
  @IsEnum(PersonType)
  type?: PersonType;

  @ApiPropertyOptional({
    description:
      'Filtrar por tipos de persona múltiples. Puede ser un array o string separado por comas "INDIVIDUAL,PLAN,PROSPECT"',
    example: [PersonType.INDIVIDUAL, PersonType.PLAN],
    enum: PersonType,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Si no hay valor, retornar undefined
    if (!value) return undefined;

    if (typeof value === 'string') {
      // Si viene como string separado por comas, convertir a array
      const types = value
        .split(',')
        .map((type) => type.trim())
        .filter((type) =>
          Object.values(PersonType).includes(type as PersonType),
        );
      return types.length > 0 ? types : undefined;
    }
    if (Array.isArray(value)) {
      // Si ya es array, filtrar solo valores válidos
      const types = value.filter((type) =>
        Object.values(PersonType).includes(type),
      );
      return types.length > 0 ? types : undefined;
    }
    return undefined;
  })
  types?: PersonType[];

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
    description: 'Filtrar por ID de localidad (para compatibilidad)',
    example: 101,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  localityId?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por IDs de localidades múltiples. Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Si no hay valor, retornar undefined
    if (!value) return undefined;

    if (typeof value === 'string') {
      // Si viene como string separado por comas, convertir a array
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      // Si ya es array, asegurar que sean números
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  localityIds?: number[];

  @ApiPropertyOptional({
    description: 'Filtrar por ID de zona (para compatibilidad)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  zoneId?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por IDs de zonas (múltiples zonas). Puede ser un array [1,2,3] o string separado por comas "1,2,3"',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Si no hay valor, retornar undefined
    if (!value) return undefined;

    if (typeof value === 'string') {
      // Si viene como string separado por comas, convertir a array
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      // Si ya es array, asegurar que sean números
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  zoneIds?: number[];

  @ApiPropertyOptional({
    description:
      'Filtrar por estado del semáforo de pagos del cliente (para compatibilidad).',
    example: 'YELLOW',
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED'],
  })
  @IsOptional()
  @IsString()
  @IsEnum(['NONE', 'GREEN', 'YELLOW', 'RED'], {
    message: 'El estado del semáforo debe ser NONE, GREEN, YELLOW o RED',
  })
  payment_semaphore_status?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por estados del semáforo de pagos múltiples. Puede ser un array o string separado por comas "NONE,GREEN,YELLOW"',
    example: ['GREEN', 'YELLOW'],
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED'],
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Si no hay valor, retornar undefined
    if (!value) return undefined;

    const validStatuses = ['NONE', 'GREEN', 'YELLOW', 'RED'];

    if (typeof value === 'string') {
      // Si viene como string separado por comas, convertir a array
      const statuses = value
        .split(',')
        .map((status) => status.trim())
        .filter((status) => validStatuses.includes(status));
      return statuses.length > 0 ? statuses : undefined;
    }
    if (Array.isArray(value)) {
      // Si ya es array, filtrar solo valores válidos
      const statuses = value.filter((status) => validStatuses.includes(status));
      return statuses.length > 0 ? statuses : undefined;
    }
    return undefined;
  })
  payment_semaphore_statuses?: string[];

  @ApiPropertyOptional({
    description:
      'Filtrar por estado activo/inactivo de la persona. Por defecto solo muestra activos (true)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value, obj }) => {
    // Unificar alias: permitir is_active, isActive o active desde la query
    const raw = value ?? obj?.isActive ?? obj?.active;

    // Si no hay valor, no aplicar filtro
    if (raw === undefined || raw === null || raw === '') return undefined;

    // Si ya es boolean, devolver tal cual
    if (typeof raw === 'boolean') return raw;

    // Si es string, normalizar y convertir
    if (typeof raw === 'string') {
      const lower = raw.toLowerCase().trim();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
      return undefined;
    }

    // Si es number, convertir a boolean
    if (typeof raw === 'number') return raw === 1;

    // Cualquier otro caso, no aplicar filtro
    return undefined;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    description:
      'Filtrar por múltiples estados activos/inactivos. Acepta formatos: "true,false", "true%false" o array [true,false]. Si incluye ambos, mostrará ambos estados.',
    isArray: true,
    type: Boolean,
    examples: [[true, false], 'true,false', 'true%false'],
  })
  @IsOptional()
  @Transform(({ value, obj }) => {
    if (value === undefined || value === null || value === '') return undefined;

    // si viene como string separado por comas o "%"
    if (typeof value === 'string') {
      const parts = value
        .split(/[,%\s]/)
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length > 0);

      const bools = parts
        .map((p) => (p === 'true' || p === '1' ? true : p === 'false' || p === '0' ? false : undefined))
        .filter((b) => b !== undefined) as boolean[];

      // Soportar palabras clave especiales
      if (parts.some((p) => p === 'both' || p === 'all' || p === 'any' || p === '*')) {
        return [true, false];
      }

      return bools.length > 0 ? Array.from(new Set(bools)) : undefined;
    }

    // si viene como array
    if (Array.isArray(value)) {
      const bools = value
        .map((v) => {
          if (typeof v === 'boolean') return v;
          if (typeof v === 'string') {
            const lower = v.toLowerCase().trim();
            if (lower === 'true' || lower === '1') return true;
            if (lower === 'false' || lower === '0') return false;
            return undefined;
          }
          if (typeof v === 'number') return v === 1;
          return undefined;
        })
        .filter((b) => b !== undefined) as boolean[];
      return bools.length > 0 ? Array.from(new Set(bools)) : undefined;
    }

    // si el usuario envió is_active='both' en lugar de is_active_values
    if (typeof obj?.is_active === 'string') {
      const val = obj.is_active.toLowerCase();
      if (val === 'both' || val === 'all' || val === 'any' || val === '*') {
        return [true, false];
      }
    }

    return undefined;
  })
  is_active_values?: boolean[];

  // Alias explícitos para pasar la validación con whitelist/forbidNonWhitelisted
  @ApiPropertyOptional({
    description: 'Alias del filtro activo/inactivo (equivalente a is_active)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
      return undefined;
    }
    if (typeof value === 'number') return value === 1;
    return undefined;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Segundo alias del filtro activo/inactivo (equivalente a is_active)',
    example: 0,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (lower === 'true' || lower === '1') return true;
      if (lower === 'false' || lower === '0') return false;
      return undefined;
    }
    if (typeof value === 'number') return value === 1;
    return undefined;
  })
  active?: boolean;
}
