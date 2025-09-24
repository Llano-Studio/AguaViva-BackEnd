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
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe tener una letra mayuscula, letra miniscula y un numero',
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
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return false;
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
