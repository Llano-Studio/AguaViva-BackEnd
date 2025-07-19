import { IsString, IsOptional, IsEmail, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez'
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico del usuario',
    example: 'usuario@example.com'
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Rol del usuario',
    enum: Role,
    example: Role.ADMINISTRATIVE
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
    type: Boolean
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Archivo de imagen de perfil (opcional). Enviar para actualizar o reemplazar la imagen existente.',
    type: 'string',
    format: 'binary'
  })
  @IsOptional()
  profileImage?: any; // El tipo real será Express.Multer.File, manejado por el controlador
} 