import { ApiProperty, OmitType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// Placeholder para la categoría del producto en la respuesta
export class ProductCategoryResponseDto {
  @ApiProperty({ example: 1 })
  category_id: number;

  @ApiProperty({ example: 'Bidones Retornables' })
  name: string;
}

// DTO para información de localidad en el almacén
export class LocalityResponseDto {
  @ApiProperty({ example: 1, description: 'ID de la localidad' })
  locality_id: number;

  @ApiProperty({ example: 'La Plata', description: 'Nombre de la localidad' })
  name: string;

  @ApiProperty({ example: 'LP001', description: 'Código de la localidad' })
  code: string;
}

// DTO para información del almacén
export class WarehouseResponseDto {
  @ApiProperty({ example: 1, description: 'ID del almacén' })
  warehouse_id: number;

  @ApiProperty({ example: 'Almacén Principal', description: 'Nombre del almacén' })
  name: string;

  @ApiProperty({ type: () => LocalityResponseDto, description: 'Localidad del almacén', required: false })
  locality?: LocalityResponseDto;
}

// DTO para información del inventario por almacén
export class ProductInventoryResponseDto {
  @ApiProperty({ example: 1, description: 'ID del almacén' })
  warehouse_id: number;

  @ApiProperty({ example: 1, description: 'ID del producto' })
  product_id: number;

  @ApiProperty({ example: 50, description: 'Cantidad disponible en este almacén' })
  quantity: number;

  @ApiProperty({ type: () => WarehouseResponseDto, description: 'Información del almacén' })
  warehouse: WarehouseResponseDto;
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

  @ApiProperty({ 
    type: [ProductInventoryResponseDto], 
    description: 'Inventario del producto por almacén',
    required: false
  })
  inventory?: ProductInventoryResponseDto[];

  @ApiProperty({ 
    example: 'https://example.com/uploads/products/product_123.jpg', 
    description: 'URL de la imagen del producto',
    required: false,
    nullable: true 
  })
  image_url?: string | null;

  // Constructor opcional para facilitar el mapeo desde la entidad Prisma + stock
  constructor(partial: Partial<ProductResponseDto> & { product_category: any, total_stock: number, inventory?: any[] }) {
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
    // Mapeo para inventory si está presente
    if (partial.inventory && Array.isArray(partial.inventory)) {
      this.inventory = partial.inventory.map(inv => ({
        warehouse_id: inv.warehouse_id,
        product_id: inv.product_id,
        quantity: inv.quantity,
        warehouse: {
          warehouse_id: inv.warehouse.warehouse_id,
          name: inv.warehouse.name,
          locality: inv.warehouse.locality ? {
            locality_id: inv.warehouse.locality.locality_id,
            name: inv.warehouse.locality.name,
            code: inv.warehouse.locality.code
          } : undefined
        }
      }));
    }
    // Convertir null a undefined para campos opcionales
    this.serial_number = partial.serial_number === null ? undefined : partial.serial_number;
    this.notes = partial.notes === null ? undefined : partial.notes;
    // Si volume_liters también puede ser null desde Prisma y es opcional en el DTO (ya lo es en CreateProductDto)
    if (partial.volume_liters === null) {
        this.volume_liters = undefined;
    }
    // Convertir null a undefined para image_url
    this.image_url = partial.image_url === null ? undefined : partial.image_url;
  }
} 