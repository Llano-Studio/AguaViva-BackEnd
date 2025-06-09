import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiProperty({
    description: 'Archivo de imagen del producto (opcional)',
    type: 'string',
    format: 'binary',
    required: false
  })
  @IsOptional()
  productImage?: any; // El tipo real será Express.Multer.File, manejado por el controlador
}
