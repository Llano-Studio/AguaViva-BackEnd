import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsDecimal,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  MaxLength,
  Matches,
} from 'class-validator';
import {
  OrderItemCoverageMode,
  OrderStatus,
  OrderType,
} from '../../common/constants/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderItemDto {
  @ApiProperty({
    description: 'ID del producto a ordenar',
    example: 1,
    examples: {
      water_20l: {
        value: 1,
        description: 'Botellón de agua 20L',
      },
      water_500ml: {
        value: 2,
        description: 'Botella de agua 500ml',
      },
      dispenser: {
        value: 15,
        description: 'Dispensador de agua',
      },
    },
  })
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @ApiProperty({
    description: 'Cantidad del producto a ordenar',
    minimum: 1,
    example: 2,
    examples: {
      standard: {
        value: 2,
        description: 'Cantidad estándar para botellones',
      },
      bulk: {
        value: 10,
        description: 'Pedido al por mayor',
      },
      single: {
        value: 1,
        description: 'Producto único (dispensadores, accesorios)',
      },
    },
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiPropertyOptional({
    description: `🆕 ID de la lista de precios específica para este producto (opcional). 
    
**Prioridad de Precios por Producto:**
1. Si se especifica \`price_list_id\` → usar esa lista específica
2. Si es orden de suscripción → usar precio proporcional del plan de suscripción  
3. Si cliente tiene contrato → usar lista de precios del contrato
4. Si no se especifica → usar lista de precios estándar
5. Fallback → precio base del producto

**Casos de Uso:**
- Productos adicionales en órdenes híbridas con descuentos especiales
- Productos promocionales con listas temporales
- Productos con precios diferenciados según cliente`,
    example: 3,
  })
  @IsOptional()
  @IsInt()
  price_list_id?: number;

  @ApiPropertyOptional({
    description:
      'Modo de cobertura del ítem. SUBSCRIPTION descuenta cuota del abono, EXTRA se cobra completo.',
    enum: OrderItemCoverageMode,
    example: OrderItemCoverageMode.SUBSCRIPTION,
  })
  @IsOptional()
  @IsEnum(OrderItemCoverageMode)
  coverage_mode?: OrderItemCoverageMode;

  @ApiPropertyOptional({
    description:
      'Suscripción asociada al ítem cuando coverage_mode = SUBSCRIPTION',
    example: 6,
  })
  @IsOptional()
  @IsInt()
  subscription_id?: number;

  @ApiPropertyOptional({
    description: 'Notas específicas para este producto',
    maxLength: 200,
    example: 'Extra frío, sin gas',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class CreateOrderDto {
  @ApiProperty({
    description: 'ID del cliente que realiza el pedido',
    example: 1,
    examples: {
      residential: {
        value: 1,
        description: 'Cliente residencial',
      },
      corporate: {
        value: 25,
        description: 'Cliente corporativo',
      },
      subscription: {
        value: 150,
        description: 'Cliente con suscripción activa',
      },
    },
  })
  @IsInt()
  @IsNotEmpty()
  customer_id: number;

  @ApiPropertyOptional({
    description: 'ID del contrato asociado al pedido (opcional)',
    example: 1,
    examples: {
      corporate_contract: {
        value: 1,
        description: 'Contrato corporativo con precios especiales',
      },
      bulk_contract: {
        value: 5,
        description: 'Contrato de compra al por mayor',
      },
    },
  })
  @IsOptional()
  @IsInt()
  contract_id?: number;

  @ApiProperty({
    description: 'ID del canal de venta',
    example: 1,
    examples: {
      online: {
        value: 1,
        description: 'Venta online/web',
      },
      phone: {
        value: 2,
        description: 'Venta telefónica',
      },
      field: {
        value: 3,
        description: 'Venta en campo/domicilio',
      },
      office: {
        value: 4,
        description: 'Venta en oficina',
      },
    },
  })
  @IsInt()
  @IsNotEmpty()
  sale_channel_id: number;

  @ApiProperty({
    description: 'Fecha del pedido en formato ISO',
    example: '2024-03-20T10:00:00Z',
    examples: {
      morning: {
        value: '2024-03-20T09:30:00Z',
        description: 'Pedido realizado en la mañana',
      },
      afternoon: {
        value: '2024-03-20T14:15:00Z',
        description: 'Pedido realizado en la tarde',
      },
      current: {
        value: '2024-03-20T10:00:00Z',
        description: 'Pedido actual',
      },
    },
  })
  @IsDateString()
  @IsNotEmpty()
  order_date: string;

  @ApiPropertyOptional({
    description: 'Fecha programada de entrega en formato ISO',
    example: '2024-03-21T14:00:00Z',
    examples: {
      next_day: {
        value: '2024-03-21T14:00:00Z',
        description: 'Entrega al día siguiente',
      },
      same_week: {
        value: '2024-03-22T10:00:00Z',
        description: 'Entrega en la misma semana',
      },
      scheduled: {
        value: '2024-03-25T16:00:00Z',
        description: 'Entrega programada para fecha específica',
      },
    },
  })
  @IsOptional()
  @IsDateString()
  scheduled_delivery_date?: string;

  @ApiPropertyOptional({
    description: 'Horario de entrega preferido en formato HH:MM-HH:MM o HH:MM',
    example: '14:00-16:00',
    pattern: '^([0-9]{2}:[0-9]{2}(-[0-9]{2}:[0-9]{2})?|[0-9]{2}:[0-9]{2})$',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^([0-9]{2}:[0-9]{2}(-[0-9]{2}:[0-9]{2})?|[0-9]{2}:[0-9]{2})$/, {
    message: 'delivery_time debe estar en formato HH:MM o HH:MM-HH:MM',
  })
  delivery_time?: string;

  @ApiProperty({
    description: `Monto total del pedido con 2 decimales.

**🆕 ÓRDENES HÍBRIDAS - Cálculo de Total:**
- **SUBSCRIPTION**: Debe ser "0.00" (productos ya pagados en suscripción)
- **HYBRID**: Solo incluye costo de productos adicionales (no del plan)
- **Otros tipos**: Total completo calculado según listas de precios

**Validación Automática:**
El sistema valida que el total coincida exactamente con la suma calculada según las listas de precios de cada producto.`,
    example: '150.00',
  })
  @IsDecimal({ decimal_digits: '2' })
  @IsNotEmpty()
  total_amount: string;

  @ApiProperty({
    description: 'Monto pagado con 2 decimales',
    example: '150.00',
  })
  @IsDecimal({ decimal_digits: '2' })
  @IsNotEmpty()
  paid_amount: string;

  @ApiProperty({
    description: `Tipo de pedido.

**🆕 SOPORTE COMPLETO PARA ÓRDENES HÍBRIDAS:**
- **SUBSCRIPTION**: Solo productos incluidos en el plan de suscripción
- **HYBRID**: Productos del plan + productos adicionales con listas individuales
- **CONTRACT_DELIVERY**: Entrega según contrato con precios del contrato
- **ONE_OFF**: Compra única con listas de precios personalizables`,
    enum: OrderType,
    example: OrderType.HYBRID,
  })
  @IsEnum(OrderType)
  @IsNotEmpty()
  order_type: OrderType;

  @ApiProperty({
    description: 'Estado del pedido',
    enum: OrderStatus,
    example: OrderStatus.PENDING,
  })
  @IsEnum(OrderStatus)
  @IsNotEmpty()
  status: OrderStatus;

  @ApiPropertyOptional({
    description: 'Notas adicionales del pedido',
    maxLength: 500,
    example: 'Entregar en la puerta trasera',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    description: `Lista de productos en el pedido con listas de precios individuales.

**🆕 LISTAS DE PRECIOS POR PRODUCTO:**
Cada producto puede tener su propia lista de precios para máxima flexibilidad:

**Ejemplos:**
- Producto de suscripción: \`{ "product_id": 1, "quantity": 2 }\` (sin price_list_id = usa plan)
- Producto adicional estándar: \`{ "product_id": 3, "quantity": 1 }\` (sin price_list_id = usa lista estándar)  
- Producto con descuento: \`{ "product_id": 5, "quantity": 1, "price_list_id": 3 }\` (usa lista corporativa)`,
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @IsNotEmpty()
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({
    description: `ID de la suscripción asociada (requerido para tipos SUBSCRIPTION y HYBRID).

**Para Órdenes Híbridas:**
- Productos que estén en el plan de suscripción usan precio del plan
- Productos adicionales usan sus listas de precios individuales`,
    example: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  subscription_id?: number;
}
