import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  IsDateString,
  Matches,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryStatus, OrderType } from '../../common/constants/enums';

@ValidatorConstraint({ name: 'atLeastOneOrderId', async: false })
export class AtLeastOneOrderIdConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: any) {
    const object = args.object;
    return !!(
      object.order_id ||
      object.one_off_purchase_id ||
      object.one_off_purchase_header_id ||
      object.cycle_payment_id
    );
  }

  defaultMessage() {
    return 'Al menos uno de los siguientes campos debe estar presente: order_id, one_off_purchase_id, one_off_purchase_header_id, cycle_payment_id';
  }
}

@ValidatorConstraint({ name: 'orderTypeRequired', async: false })
export class OrderTypeRequiredConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: any) {
    const object = args.object;
    // Si se especifica order_id, entonces order_type es requerido
    if (object.order_id && !object.order_type) {
      return false;
    }
    return true;
  }

  defaultMessage() {
    return 'order_type es requerido cuando se especifica order_id';
  }
}

export class CreateRouteSheetDetailDto {
  @Validate(AtLeastOneOrderIdConstraint)
  @Validate(OrderTypeRequiredConstraint)
  @ApiPropertyOptional({
    description: 'ID del pedido que debe ser entregado. REQUERIDO especificar order_type cuando se usa este campo.',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  order_id?: number;

  @ApiPropertyOptional({
    description: `Tipo de orden cuando se especifica order_id. REQUERIDO cuando order_id está presente.
    
    Tipos disponibles:
    - HYBRID: Órdenes de cobranza manual/suscripciones híbridas
    - ONE_OFF: Compras únicas de clientes
    
    Ejemplos de uso:
    - Para cobranzas manuales: order_type: "HYBRID"
    - Para compras únicas: order_type: "ONE_OFF"`,
    enum: OrderType,
    example: OrderType.HYBRID,
    examples: {
      hybrid: {
        value: OrderType.HYBRID,
        description: 'Para órdenes de cobranza manual'
      },
      oneOff: {
        value: OrderType.ONE_OFF,
        description: 'Para compras únicas de clientes'
      },
      subscription: {
        value: OrderType.SUBSCRIPTION,
        description: 'Para órdenes de suscripción regulares'
      }
    }
  })
  @IsEnum(OrderType)
  @IsOptional()
  order_type?: OrderType;

  @ApiPropertyOptional({
    description: 'ID de la compra one-off individual que debe ser entregada',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  one_off_purchase_id?: number;

  @ApiPropertyOptional({
    description:
      'ID de la compra one-off con múltiples productos que debe ser entregada',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  one_off_purchase_header_id?: number;

  @ApiPropertyOptional({
    description: 'ID del pedido de cobranza que debe ser procesado',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  cycle_payment_id?: number;

  @ApiPropertyOptional({
    description: 'Estado inicial de la entrega (por defecto PENDING)',
    example: 'PENDING',
    default: 'PENDING',
  })
  @IsString()
  @IsOptional()
  delivery_status?: string = DeliveryStatus.PENDING;

  @ApiPropertyOptional({
    description:
      'Horario de entrega programado. Puede ser un horario específico (HH:MM) o un rango (HH:MM-HH:MM)',
    example: '08:00-16:00',
  })
  @IsString()
  @IsOptional()
  delivery_time?: string;

  @ApiPropertyOptional({
    description: 'Comentarios adicionales',
    example: 'Llamar al cliente antes de entregar',
  })
  @IsString()
  @IsOptional()
  comments?: string;
}

export class CreateRouteSheetDto {
  @ApiProperty({
    description: 'ID del conductor asignado',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  driver_id: number;

  @ApiProperty({
    description: 'ID del vehículo asignado',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  vehicle_id: number;

  @ApiProperty({
    description: 'Fecha de entrega programada (YYYY-MM-DD)',
    example: '2023-07-15',
  })
  @IsDateString()
  @IsNotEmpty()
  delivery_date: string;

  @ApiPropertyOptional({
    description: 'Notas sobre la ruta',
    example: 'Ruta por zona norte',
  })
  @IsString()
  @IsOptional()
  route_notes?: string;

  @ApiProperty({
    description: 'Detalles de los pedidos a entregar',
    type: [CreateRouteSheetDetailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRouteSheetDetailDto)
  details: CreateRouteSheetDetailDto[];
}
