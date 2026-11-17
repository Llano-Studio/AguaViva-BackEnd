import { ApiProperty } from '@nestjs/swagger';
import { CustomerCurrentAccountType } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';

/**
 * Cuenta corriente que el cliente puede usar al pagar en ruta: `OWN` (cuenta
 * propia, para clientes grandes), `DRIVER` (la del chofer) o `NONE` (ninguna).
 */
export class UpdateCurrentAccountTypeDto {
  @ApiProperty({
    enum: CustomerCurrentAccountType,
    example: CustomerCurrentAccountType.OWN,
  })
  @IsEnum(CustomerCurrentAccountType)
  current_account_type: CustomerCurrentAccountType;
}

export class BulkUpdateCurrentAccountTypeDto extends UpdateCurrentAccountTypeDto {
  @ApiProperty({ type: [Number], example: [5885, 5890] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1, { each: true })
  person_ids: number[];
}

export class CurrentAccountTypeResultDto {
  @ApiProperty({ example: 5885 })
  person_id: number;

  @ApiProperty({ example: 'Almacén Don Pepe', nullable: true })
  name: string | null;

  @ApiProperty({ enum: CustomerCurrentAccountType })
  current_account_type: CustomerCurrentAccountType;
}

export class BulkCurrentAccountTypeResultDto {
  @ApiProperty({ example: 2 })
  updated: number;

  @ApiProperty({
    type: [Number],
    description: 'IDs que no existen',
    example: [],
  })
  not_found: number[];
}
