import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsEnum,
  MinLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Contraseña del usuario (mínimo 6 caracteres)',
    example: 'Password123',
  })
  @IsString()
  @MinLength(6)
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: Role,
    example: Role.ADMINISTRATIVE,
  })
  @IsEnum(Role)
  @IsNotEmpty()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase() as Role;
    }
    return value;
  })
  role: Role;

  @ApiProperty({
    description: 'Estado activo/inactivo del usuario',
    example: true,
    default: true,
    required: false,
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

    // Para cualquier otro caso, devolver true por defecto en creación
    return true;
  })
  isActive?: boolean = true;

  @ApiProperty({
    description: 'Notas sobre el usuario',
    example: 'Operador de ventas zona sur',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({
    description: 'Archivo de imagen de perfil (opcional)',
    type: 'string',
    format: 'binary',
    required: false,
  })
  @IsOptional()
  profileImage?: any; // El tipo real será Express.Multer.File, manejado por el controlador
}
