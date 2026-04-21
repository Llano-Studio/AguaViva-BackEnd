import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsEnum,
  MinLength,
  IsArray,
  ArrayMinSize,
  ArrayUnique,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { Role } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserSystemAccessDto } from './user-system-access.dto';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico del usuario',
    example: 'usuario@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario',
    enum: Role,
    example: Role.ADMINISTRATIVE,
  })
  @IsOptional()
  @IsEnum(Role)
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase() as Role;
    }
    return value;
  })
  role?: Role;

  @ApiPropertyOptional({
    description: 'Estado activo/inactivo del usuario',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    // Si ya es boolean, devolverlo tal como está
    if (typeof value === 'boolean') {
      return value;
    }

    // Si es string, convertir a boolean
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase().trim();
      if (lowerValue === 'true' || lowerValue === '1') {
        return true;
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return false;
      }
    }

    // Si es number, convertir a boolean
    if (typeof value === 'number') {
      return value === 1;
    }

    // Para cualquier otro caso (null, undefined, etc.), devolver undefined
    // para que el campo sea opcional y no se actualice si no se envía
    return undefined;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Nueva contraseña (mínimo 8 caracteres)',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    description:
      'Accesos multi-sistema (string JSON en multipart o array en JSON).',
    oneOf: [
      { type: 'array', items: { $ref: '#/components/schemas/UserSystemAccessDto' } },
      {
        type: 'string',
        example:
          '[{"system":"AGUAVIVA","role":"SUPERADMIN","isActive":true},{"system":"AGUARICA","role":"ADMINISTRATIVE","isActive":true}]',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((access: UserSystemAccessDto) => access.system, {
    message: 'No se puede repetir el sistema dentro de los accesos.',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return plainToInstance(UserSystemAccessDto, JSON.parse(value));
    } catch {
      return value;
    }
  })
  @ValidateNested({ each: true })
  @Type(() => UserSystemAccessDto)
  accesses?: UserSystemAccessDto[];

  @ApiPropertyOptional({
    description:
      'Archivo de imagen de perfil (opcional). Enviar para actualizar o reemplazar la imagen existente.',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  profileImage?: any;
}
