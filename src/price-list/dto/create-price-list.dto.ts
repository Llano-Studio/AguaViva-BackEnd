import { IsString, IsDateString, IsNotEmpty } from 'class-validator';

export class CreatePriceListDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  @IsNotEmpty()
  effective_date: string; 
} 