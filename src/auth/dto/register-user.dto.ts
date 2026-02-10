import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class RegisterUserDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      'Contraseña del usuario (mínimo 6 caracteres, debe contener mayúscula, minúscula y número)',
    example: 'Password123',
  })
  @IsString()
  @MinLength(6, {
    message: 'La contraseña debe tener al menos 6 caracteres',
  })
  @MaxLength(50, {
    message: 'La contraseña no puede tener más de 50 caracteres',
  })
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe contener al menos: una letra mayúscula, una letra minúscula y un número',
  })
  password: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({
    description: 'Archivo de imagen de perfil (opcional)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  profileImage?: any;

  @ApiPropertyOptional({
    description: 'Estado activo/inactivo del usuario',
    example: true,
    default: true,
    type: Boolean,
  })
  @IsBoolean()
  @IsOptional()
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

    return undefined;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Rol del usuario',
    enum: Role,
    example: Role.ADMINISTRATIVE,
  })
  @IsEnum(Role)
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase() as Role;
    }
    return value;
  })
  role?: Role;
}
