import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, OrderType } from '../../common/constants/enums';

export class OrderItemResponseDto {
    @ApiProperty({
        description: 'ID del ítem del pedido',
        example: 1
    })
    order_item_id: number;

    @ApiProperty({
        description: 'ID del producto',
        example: 1
    })
    product_id: number;

    @ApiProperty({
        description: 'Cantidad del producto',
        example: 2
    })
    quantity: number;

    @ApiProperty({
        description: '🆕 Precio unitario aplicado al producto',
        example: '25.50'
    })
    unit_price: string;

    @ApiProperty({
        description: 'Subtotal del ítem (precio unitario × cantidad)',
        example: '51.00'
    })
    subtotal: string;

    @ApiProperty({
        description: 'Cantidad entregada del producto',
        example: 2,
        nullable: true
    })
    delivered_quantity?: number;

    @ApiProperty({
        description: 'Cantidad devuelta del producto',
        example: 0,
        nullable: true
    })
    returned_quantity?: number;

    @ApiProperty({
        description: '🆕 ID de la lista de precios utilizada para este producto (opcional)',
        example: 3,
        nullable: true
    })
    price_list_id?: number;

    @ApiProperty({
        description: '🆕 Notas específicas del ítem',
        example: 'Extra frío',
        nullable: true
    })
    notes?: string;

    @ApiProperty({
        description: '🆕 ID del plan de suscripción (abono) asociado al producto en órdenes híbridas',
        example: 1,
        nullable: true
    })
    abono_id?: number;

    @ApiProperty({
        description: '🆕 Nombre del plan de suscripción (abono) asociado al producto en órdenes híbridas',
        example: 'Plan Familiar Mensual',
        nullable: true
    })
    abono_name?: string;

    @ApiProperty({
        description: 'Detalles del producto',
        type: 'object',
        properties: {
            product_id: { type: 'number', example: 1 },
            description: { type: 'string', example: 'Agua Mineral 500ml' },
            price: { type: 'string', example: '25.50' },
            is_returnable: { type: 'boolean', example: true }
        },
        additionalProperties: false
    })
    product: {
        product_id: number;
        description: string;
        price: string;
        is_returnable: boolean;
    };
}

export class OrderResponseDto {
    @ApiProperty({
        description: 'ID del pedido',
        example: 1
    })
    order_id: number;

    @ApiProperty({
        description: 'ID del cliente',
        example: 1
    })
    customer_id: number;

    @ApiProperty({
        description: 'ID del contrato (opcional)',
        example: 1,
        nullable: true
    })
    contract_id?: number;

    @ApiProperty({
        description: 'ID de la suscripción (opcional)',
        example: 1,
        nullable: true
    })
    subscription_id?: number;

    @ApiProperty({
        description: 'ID del canal de venta',
        example: 1
    })
    sale_channel_id: number;

    @ApiProperty({
        description: 'Fecha del pedido',
        example: '2024-03-20T10:00:00Z'
    })
    order_date: string;

    @ApiProperty({
        description: 'Fecha programada de entrega',
        example: '2024-03-21T14:00:00Z',
        nullable: true
    })
    scheduled_delivery_date?: string;

    @ApiProperty({
        description: 'Horario de entrega',
        example: '14:00-16:00',
        nullable: true
    })
    delivery_time?: string;

    @ApiProperty({
        description: 'Monto total del pedido',
        example: '150.00'
    })
    total_amount: string;

    @ApiProperty({
        description: 'Monto pagado',
        example: '150.00'
    })
    paid_amount: string;

    @ApiProperty({
        description: 'Tipo de pedido',
        enum: OrderType,
        example: OrderType.CONTRACT_DELIVERY
    })
    order_type: OrderType;

    @ApiProperty({
        description: 'Estado del pedido',
        enum: OrderStatus,
        example: OrderStatus.PENDING
    })
    status: OrderStatus;

    @ApiProperty({
        description: 'Notas del pedido',
        example: 'Entregar en la puerta trasera',
        nullable: true
    })
    notes?: string;

    @ApiProperty({
        description: 'Dirección de entrega específica para este pedido',
        example: 'Av. Principal 123, Centro',
        nullable: true
    })
    delivery_address?: string;

    @ApiProperty({
        description: 'Ítems del pedido',
        type: [OrderItemResponseDto]
    })
    order_item: OrderItemResponseDto[];

    @ApiProperty({
        description: 'Detalles del cliente',
        type: 'object',
        properties: {
            person_id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'Juan Pérez' },
            phone: { type: 'string', example: '1234567890' },
            locality: { 
                type: 'object', 
                properties: {
                    locality_id: { type: 'number', example: 1 },
                    name: { type: 'string', example: 'Centro' }
                },
                nullable: true
            },
            zone: { 
                type: 'object', 
                properties: {
                    zone_id: { type: 'number', example: 1 },
                    name: { type: 'string', example: 'Centro' }
                },
                nullable: true
            }
        },
        additionalProperties: false
    })
    customer: {
        person_id: number;
        name: string;
        phone: string;
        locality?: {
            locality_id: number;
            name: string;
        };
        zone?: {
            zone_id: number;
            name: string;
        }
    };

    @ApiProperty({
        description: 'Detalles del canal de venta',
        type: 'object',
        properties: {
            sale_channel_id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'Tienda Online' }
        },
        additionalProperties: false
    })
    sale_channel: {
        sale_channel_id: number;
        name: string;
    };

    @ApiProperty({
        description: 'Zona de la orden',
        type: 'object',
        properties: {
            zone_id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'Centro' }
        },
        nullable: true
    })
    zone?: {
        zone_id: number;
        name: string;
    };
}