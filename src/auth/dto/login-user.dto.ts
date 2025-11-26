import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';

export class LoginUserDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario registrado en el sistema',
    example: 'admin@aguaviva.com',
    examples: {
      admin: {
        value: 'admin@aguaviva.com',
        description: 'Usuario administrador del sistema',
      },
      driver: {
        value: 'conductor.zona1@aguaviva.com',
        description: 'Conductor de entregas',
      },
      sales: {
        value: 'ventas.centro@aguaviva.com',
        description: 'Personal de ventas',
      },
    },
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      'Contraseña del usuario (mínimo 6 caracteres, debe contener mayúscula, minúscula y número)',
    example: 'AguaViva2024!',
    examples: {
      secure: {
        value: 'AguaViva2024!',
        description: 'Contraseña segura con todos los requisitos',
      },
      basic: {
        value: 'Password123',
        description: 'Contraseña básica válida',
      },
    },
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(50)
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La contraseña debe tener una letra mayuscula, letra miniscula y un numero',
  })
  password: string;
}

// Nuevo DTO para la respuesta del login/refresh
export class UserLoginDetailsDto {
  @ApiProperty({
    description: 'ID único del usuario en el sistema',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'admin@aguaviva.com',
  })
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Carlos Administrador',
  })
  name: string;

  @ApiProperty({
    description: 'Rol del usuario en el sistema',
    example: 'SUPERADMIN',
    examples: {
      superadmin: {
        value: 'SUPERADMIN',
        description: 'Acceso completo al sistema',
      },
      admin: {
        value: 'ADMINISTRATIVE',
        description: 'Administrador con permisos limitados',
      },
      driver: {
        value: 'DRIVER',
        description: 'Conductor de entregas',
      },
    },
  })
  role: string; // o el enum Role si se prefiere
}

export class LoginResponseDto {
  @ApiProperty({ type: UserLoginDetailsDto })
  user: UserLoginDetailsDto;

  @ApiProperty({
    description: 'Token de acceso JWT (válido por 15 minutos)',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AYWd1YXZpdmEuY29tIiwicm9sZSI6IlNVUEVSQURNSU4iLCJpYXQiOjE3MDk1NjgwMDAsImV4cCI6MTcwOTU2ODkwMH0.signature',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token de refresco JWT (válido por 7 días)',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYWRtaW5AYWd1YXZpdmEuY29tIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MDk1NjgwMDAsImV4cCI6MTcxMDE3MjgwMH0.signature',
  })
  refreshToken: string;
}
