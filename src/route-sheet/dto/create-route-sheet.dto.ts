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
    description: `ID del pedido que debe ser entregado. REQUERIDO especificar order_type cuando se usa este campo.
    
    🔹 Usar para órdenes HYBRID, SUBSCRIPTION, CONTRACT_DELIVERY
    ⚠️ NO usar para compras one-off (usar one_off_purchase_id o one_off_purchase_header_id en su lugar)`,
    example: 21,
  })
  @IsInt()
  @IsOptional()
  order_id?: number;

  @ApiPropertyOptional({
    description: `Tipo de orden cuando se especifica order_id. REQUERIDO cuando order_id está presente.
    
    Tipos disponibles:
    - HYBRID: Órdenes de cobranza manual/suscripciones híbridas
    - SUBSCRIPTION: Órdenes de suscripción regulares
    - CONTRACT_DELIVERY: Entregas por contrato
    
    ⚠️ NO usar ONE_OFF aquí. Para compras one-off usar one_off_purchase_id o one_off_purchase_header_id`,
    enum: OrderType,
    example: OrderType.HYBRID,
    examples: {
      hybrid: {
        value: OrderType.HYBRID,
        description: 'Para órdenes de cobranza manual'
      },
      subscription: {
        value: OrderType.SUBSCRIPTION,
        description: 'Para órdenes de suscripción regulares'
      },
      contractDelivery: {
        value: OrderType.CONTRACT_DELIVERY,
        description: 'Para entregas por contrato'
      }
    }
  })
  @IsEnum(OrderType)
  @IsOptional()
  order_type?: OrderType;

  @ApiPropertyOptional({
    description: `ID de la compra one-off individual (tabla one_off_purchase).
    
    🔹 Usar para compras one-off de UN SOLO PRODUCTO
    ⚠️ NO incluir order_type cuando uses este campo
    ⚠️ NO usar order_id cuando uses este campo
    
    Ejemplo de uso en payload:
    {
      "one_off_purchase_id": 5,
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }`,
    example: 5,
  })
  @IsInt()
  @IsOptional()
  one_off_purchase_id?: number;

  @ApiPropertyOptional({
    description: `ID de la compra one-off con múltiples productos (tabla one_off_purchase_header).
    
    🔹 Usar para compras one-off de MÚLTIPLES PRODUCTOS
    ⚠️ NO incluir order_type cuando uses este campo
    ⚠️ NO usar order_id cuando uses este campo
    
    Ejemplo de uso en payload:
    {
      "one_off_purchase_header_id": 3,
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }`,
    example: 3,
  })
  @IsInt()
  @IsOptional()
  one_off_purchase_header_id?: number;

  @ApiPropertyOptional({
    description: `ID del pedido de cobranza que debe ser procesado.
    
    🔹 Usar para pagos de ciclos de suscripción
    ⚠️ NO incluir order_type cuando uses este campo`,
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
    description: `Detalles de los pedidos a entregar. Puedes mezclar diferentes tipos de órdenes en la misma hoja de ruta.
    
    📋 TIPOS DE ÓRDENES SOPORTADAS:
    
    1️⃣ Órdenes HYBRID/SUBSCRIPTION/CONTRACT (usar order_id + order_type):
    {
      "order_id": 21,
      "order_type": "HYBRID",
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }
    
    2️⃣ Compras one-off de un solo producto (usar one_off_purchase_id):
    {
      "one_off_purchase_id": 5,
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }
    
    3️⃣ Compras one-off con múltiples productos (usar one_off_purchase_header_id):
    {
      "one_off_purchase_header_id": 3,
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }
    
    4️⃣ Cobros de ciclo de suscripción (usar cycle_payment_id):
    {
      "cycle_payment_id": 1,
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }
    
    ✅ EJEMPLO COMPLETO MEZCLANDO TIPOS:
    "details": [
      { "order_id": 21, "order_type": "HYBRID", "delivery_status": "PENDING", "delivery_time": "08:00-12:00" },
      { "one_off_purchase_id": 5, "delivery_status": "PENDING", "delivery_time": "08:00-12:00" },
      { "one_off_purchase_header_id": 3, "delivery_status": "PENDING", "delivery_time": "12:00-16:00" }
    ]`,
    type: [CreateRouteSheetDetailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRouteSheetDetailDto)
  details: CreateRouteSheetDetailDto[];
}
