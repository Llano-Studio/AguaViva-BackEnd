import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsInt()
  localityId: number;

  @IsInt()
  zoneId: number;

  @IsDateString()
  @IsOptional()
  registrationDate: string;

  @IsString()
  @IsNotEmpty()
  type: string;

}

