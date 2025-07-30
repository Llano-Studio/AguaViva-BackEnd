import { ApiProperty } from '@nestjs/swagger';
import { CreatePersonDto } from './create-person.dto';
import { PaymentSemaphoreStatus } from '../../common/config/business.config';

export class LoanedProductDetailDto {
  @ApiProperty({ example: 1, description: 'ID del producto en comodato' })
  product_id: number;

  @ApiProperty({ example: 'Bidón 20L Retornable', description: 'Descripción del producto' })
  description: string;

  @ApiProperty({ example: 3, description: 'Cantidad neta del producto en comodato con el cliente' })
  loaned_quantity: number;

  @ApiProperty({ example: '2024-01-15', description: 'Fecha de adquisición del producto' })
  acquisition_date: string;

  @ApiProperty({ example: 123, description: 'ID del pedido donde se adquirió el producto' })
  order_id: number;

  @ApiProperty({ example: 'DELIVERED', description: 'Estado del pedido donde se adquirió' })
  order_status: string;
}

export class LoanedProductDto {
  @ApiProperty({ example: 1, description: 'ID del producto en comodato' })
  product_id: number;

  @ApiProperty({ example: 'Bidón 20L Retornable', description: 'Descripción del producto' })
  description: string;

  @ApiProperty({ example: 3, description: 'Cantidad neta del producto en comodato con el cliente' })
  loaned_quantity: number;
}

export class PersonResponseDto extends CreatePersonDto {
  @ApiProperty({ example: 1 })
  person_id: number;

  @ApiProperty({ example: '2023-06-15' })
  registration_date: Date;

  @ApiProperty({ 
    description: 'Objeto de localidad completo (incluye provincia)',
    example: { locality_id: 1, name: 'Rosario', province: { province_id: 1, name: 'Santa Fe' } } 
  })
  locality: any;

  @ApiProperty({ 
    description: 'Objeto de zona completo',
    example: { zone_id: 1, name: 'Centro' } 
  })
  zone: any;

  @ApiProperty({ 
    type: [LoanedProductDto], 
    description: 'Lista de productos en comodato por el cliente (resumen)', 
    example: [{ product_id: 1, description: 'Bidón 20L Retornable', loaned_quantity: 2 }] 
  })
  loaned_products: LoanedProductDto[];

  @ApiProperty({ 
    type: [LoanedProductDetailDto], 
    description: 'Lista detallada de productos en comodato por el cliente con fechas de adquisición', 
    example: [{ 
      product_id: 1, 
      description: 'Bidón 20L Retornable', 
      loaned_quantity: 2,
      acquisition_date: '2024-01-15',
      order_id: 123,
      order_status: 'DELIVERED'
    }] 
  })
  loaned_products_detail: LoanedProductDetailDto[];

  @ApiProperty({ 
    example: 'YELLOW', 
    description: 'Estado del semáforo de pagos del cliente (NONE, GREEN, YELLOW, RED)',
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED']
  })
  payment_semaphore_status: PaymentSemaphoreStatus;
} 