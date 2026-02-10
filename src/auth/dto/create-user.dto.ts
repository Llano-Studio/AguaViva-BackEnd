import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsNotEmpty,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    description:
      'Correo electrónico del usuario (debe ser único en el sistema)',
    example: 'nuevo.empleado@aguaviva.com',
    examples: {
      admin: {
        value: 'admin.sucursal@aguaviva.com',
        description: 'Usuario administrativo de sucursal',
      },
      driver: {
        value: 'conductor.zona2@aguaviva.com',
        description: 'Conductor de entregas zona 2',
      },
      sales: {
        value: 'ventas.norte@aguaviva.com',
        description: 'Vendedor zona norte',
      },
    },
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'María Elena González',
    examples: {
      admin: {
        value: 'Carlos Roberto Administrador',
        description: 'Nombre de usuario administrativo',
      },
      driver: {
        value: 'José Luis Conductor',
        description: 'Nombre de conductor',
      },
      sales: {
        value: 'Ana Patricia Vendedora',
        description: 'Nombre de vendedora',
      },
    },
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description:
      'Contraseña del usuario (mínimo 6 caracteres, debe contener mayúscula, minúscula y número)',
    example: 'AguaViva2024!',
    examples: {
      secure: {
        value: 'AguaViva2024!',
        description: 'Contraseña segura recomendada',
      },
      basic: {
        value: 'Password123',
        description: 'Contraseña básica válida',
      },
    },
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
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  password: string;

  @ApiProperty({
    description: 'Rol del usuario en el sistema',
    enum: Role,
    example: Role.ADMINISTRATIVE,
    examples: {
      superadmin: {
        value: Role.SUPERADMIN,
        description:
          'Acceso completo al sistema - solo para administradores principales',
      },
      admin: {
        value: Role.ADMINISTRATIVE,
        description: 'Administrador con permisos de gestión',
      },
      bossadmin: {
        value: Role.BOSSADMINISTRATIVE,
        description: 'Jefe administrativo con permisos extendidos',
      },
      driver: {
        value: Role.DRIVERS,
        description: 'Conductor de entregas',
      },
    },
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
    description: 'Notas adicionales sobre el usuario',
    example: 'Operador de ventas zona sur - Turno mañana',
    examples: {
      driver: {
        value: 'Conductor con licencia profesional - Zona norte y centro',
        description: 'Notas para conductor',
      },
      admin: {
        value: 'Administrador de sucursal - Responsable de inventario',
        description: 'Notas para administrador',
      },
      sales: {
        value: 'Vendedor especializado en clientes corporativos',
        description: 'Notas para vendedor',
      },
    },
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
