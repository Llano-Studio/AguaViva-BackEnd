import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PortalUpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  alias?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tax_id?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  locality_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  zone_id?: number;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  secondary_phone?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  additional_phones?: string;
}

export class PortalProfileResponseDto {
  @ApiProperty() person_id: number;
  @ApiProperty() phone: string;
  @ApiPropertyOptional() name?: string | null;
  @ApiPropertyOptional() alias?: string | null;
  @ApiPropertyOptional() tax_id?: string | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiPropertyOptional() secondary_phone?: string | null;
  @ApiPropertyOptional() additional_phones?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) locality_id?: number | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) zone_id?: number | null;
  @ApiProperty() type: string;
  @ApiProperty() is_active: boolean;
  @ApiProperty() owns_returnable_containers: boolean;
  @ApiProperty() has_portal_password: boolean;
  @ApiProperty() registration_date: Date;
}

export class PortalChangePasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
