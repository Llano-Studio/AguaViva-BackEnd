import { ApiProperty } from '@nestjs/swagger';
import { CreatePersonDto } from './create-person.dto';
import { PaymentSemaphoreStatus } from '../../common/config/business.config';

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
    description: 'Lista de productos en comodato por el cliente', 
    example: [{ product_id: 1, description: 'Bidón 20L Retornable', loaned_quantity: 2 }] 
  })
  loaned_products: LoanedProductDto[];

  @ApiProperty({ 
    example: 'YELLOW', 
    description: 'Estado del semáforo de pagos del cliente (NONE, GREEN, YELLOW, RED)',
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED']
  })
  payment_semaphore_status: PaymentSemaphoreStatus;
} 