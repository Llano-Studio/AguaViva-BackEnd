import { IsString, IsOptional, IsEmail, IsBoolean, IsEnum } from 'class-validator';
import { Role } from '../../constants/enums';

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
} 