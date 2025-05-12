import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    description: 'ID del usuario',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@example.com'
  })
  email: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez'
  })
  name: string;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: Role,
    example: Role.USER
  })
  role: Role;

  @ApiProperty({
    description: 'Estado activo/inactivo del usuario',
    example: true
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Fecha de creación',
    example: '2023-01-01T12:00:00Z'
  })
  createdAt: string;

  @ApiProperty({
    description: 'Fecha de última actualización',
    example: '2023-01-10T15:30:00Z',
    required: false
  })
  updatedAt?: string;

  @ApiProperty({
    description: 'Notas sobre el usuario',
    example: 'Operador de ventas zona sur',
    required: false
  })
  notes?: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
} 