import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export enum SystemType {
  AGUAVIVA = 'AGUAVIVA',
  AGUARICA = 'AGUARICA',
}

export class UserSystemAccessDto {
  @ApiProperty({ enum: SystemType, enumName: 'SystemType' })
  @IsEnum(SystemType)
  system!: SystemType;

  @ApiProperty({ enum: Role, enumName: 'Role' })
  @IsEnum(Role)
  role!: Role;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
