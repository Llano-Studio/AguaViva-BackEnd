import { IsString, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePriceListDto {
  @ApiProperty({ 
    description: 'Nombre de la lista de precios', 
    example: 'Lista de Precios Mayorista 2024' 
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ 
    description: 'Fecha de vigencia de la lista de precios (YYYY-MM-DD)', 
    example: '2024-01-01' 
  })
  @IsDateString()
  @IsNotEmpty()
  effective_date: string; 
} 