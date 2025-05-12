import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// Placeholder para la categoría del producto en la respuesta
export class ProductCategoryResponseDto {
  @ApiProperty({ example: 1 })
  category_id: number;

  @ApiProperty({ example: 'Bidones Retornables' })
  name: string;
}

// Heredamos de CreateProductDto y omitimos category_id porque se representa en product_category
export class ProductResponseDto extends OmitType(CreateProductDto, ['category_id'] as const) {
  @ApiProperty({ example: 1, description: 'ID único del producto' })
  product_id: number;

  // Las propiedades de CreateProductDto (description, volume_liters, price, is_returnable, serial_number, notes)
  // son heredadas automáticamente, excepto category_id.

  @ApiProperty({ type: () => ProductCategoryResponseDto, description: 'Categoría del producto' })
  product_category: ProductCategoryResponseDto;

  @ApiProperty({ example: 100, description: 'Stock total disponible del producto en todos los almacenes' })
  total_stock: number;

  // Constructor opcional para facilitar el mapeo desde la entidad Prisma + stock
  constructor(partial: Partial<ProductResponseDto> & { product_category: any, total_stock: number }) {
    super();
    Object.assign(this, partial);
    // Aseguramos que los tipos Decimal de Prisma se conviertan a number si es necesario
    if (typeof partial.price === 'object' && partial.price !== null) { 
      this.price = Number(partial.price);
    }
    if (typeof partial.volume_liters === 'object' && partial.volume_liters !== null) {
      this.volume_liters = Number(partial.volume_liters);
    }
    // Mapeo explícito para product_category si es necesario
    if (partial.product_category) {
        this.product_category = {
            category_id: partial.product_category.category_id,
            name: partial.product_category.name
        }
    }
    // Convertir null a undefined para campos opcionales
    this.serial_number = partial.serial_number === null ? undefined : partial.serial_number;
    this.notes = partial.notes === null ? undefined : partial.notes;
    // Si volume_liters también puede ser null desde Prisma y es opcional en el DTO (ya lo es en CreateProductDto)
    if (partial.volume_liters === null) {
        this.volume_liters = undefined;
    }
  }
} 