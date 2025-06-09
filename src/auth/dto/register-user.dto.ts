import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(
    /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'La contraseña debe tener una letra mayuscula, letra miniscula y un numero'
  })
  password: string;

  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'Archivo de imagen de perfil (opcional)',
    type: 'string',
    format: 'binary',
    required: false
  })
  @IsOptional()
  profileImage?: any; 

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
} 