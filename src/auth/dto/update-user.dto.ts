import { IsString, IsOptional, IsEmail, IsBoolean, IsEnum } from 'class-validator';
import { Role } from '../../common/constants/enums';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Archivo de imagen de perfil (opcional). Enviar para actualizar o reemplazar la imagen existente.',
    type: 'string',
    format: 'binary',
    required: false
  })
  @IsOptional()
  profileImage?: any; // El tipo real será Express.Multer.File, manejado por el controlador
} 