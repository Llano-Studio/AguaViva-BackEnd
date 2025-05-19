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
        description: 'Subtotal del ítem',
        example: '100.00'
    })
    subtotal: string;

    @ApiProperty({
        description: 'Monto total del ítem',
        example: '100.00'
    })
    total_amount: string;

    @ApiProperty({
        description: 'Monto pagado del ítem',
        example: '100.00'
    })
    amount_paid: string;

    @ApiProperty({
        description: 'Detalles del producto',
        type: 'object',
        properties: {
            product_id: { type: 'number', example: 1 },
            description: { type: 'string', example: 'Producto 1' },
            price: { type: 'string', example: '50.00' }
        },
        additionalProperties: false
    })
    product: {
        product_id: number;
        description: string;
        price: string;
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
        example: OrderType.REGULAR
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
                    name: { type: 'string', example: 'Centro' },
                    zone: {
                        type: 'object',
                        properties: {
                            zone_id: { type: 'number', example: 1 },
                            name: { type: 'string', example: 'Zona Norte' }
                        }
                    }
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
            zone?: {
                zone_id: number;
                name: string;
            }
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
} 