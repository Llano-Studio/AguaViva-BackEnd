import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateProductCategoryDto {
  @ApiProperty({ example: 'Bebidas', description: 'Nombre de la categoría' })
  @IsString()
  name: string;
}
