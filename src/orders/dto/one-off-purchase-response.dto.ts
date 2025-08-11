import { ApiProperty } from '@nestjs/swagger';

export class OneOffPurchasePriceListResponseDto {
    @ApiProperty({ 
        example: 1,
        description: 'ID de la lista de precios utilizada en la compra'
    })
    price_list_id: number;
    
    @ApiProperty({ 
        example: 'Lista Mayorista',
        description: 'Nombre de la lista de precios'
    })
    name: string;
    
    @ApiProperty({ 
        example: '450.00',
        description: 'Precio unitario del producto según la lista de precios utilizada'
    })
    unit_price: string;
}

export class OneOffPurchaseProductResponseDto {
    @ApiProperty({ 
        example: 1,
        description: 'ID del producto comprado'
    })
    product_id: number;
    
    @ApiProperty({ 
        example: 'Agua Bidón 20L',
        description: 'Descripción del producto'
    })
    description: string;
    
    @ApiProperty({ 
        example: 2,
        description: 'Cantidad del producto comprado'
    })
    quantity: number;
    
    @ApiProperty({ 
        type: OneOffPurchasePriceListResponseDto, 
        nullable: true,
        description: 'Información de la lista de precios utilizada para este producto (incluye ID, nombre y precio unitario)'
    })
    price_list?: OneOffPurchasePriceListResponseDto;
}

export class OneOffPurchasePersonResponseDto {
    @ApiProperty({ example: 1 })
    person_id: number;
    @ApiProperty({ example: 'Cliente Ocasional' })
    name: string;
    @ApiProperty({ example: '1234567890', description: 'Teléfono del cliente' })
    phone: string;
    @ApiProperty({ example: 'Av. Principal 123, Centro', nullable: true, description: 'Dirección del cliente' })
    address?: string;
}

export class OneOffPurchaseSaleChannelResponseDto {
    @ApiProperty({ example: 1 })
    sale_channel_id: number;
    @ApiProperty({ example: 'Venta Directa' })
    name: string;
}

export class OneOffPurchaseLocalityResponseDto {
    @ApiProperty({ example: 1 })
    locality_id: number;
    @ApiProperty({ example: 'Centro' })
    name: string;
}

export class OneOffPurchaseZoneResponseDto {
    @ApiProperty({ example: 1 })
    zone_id: number;
    @ApiProperty({ example: 'Zona 1' })
    name: string;
}

export class OneOffPurchaseResponseDto {
    @ApiProperty({ example: 1 })
    purchase_id: number;

    @ApiProperty({ example: 1 })
    person_id: number;


    @ApiProperty({ example: '2024-03-25T10:00:00Z' })
    purchase_date: string;

    @ApiProperty({ example: '2024-03-26T14:00:00Z', nullable: true })
    scheduled_delivery_date?: string;

    @ApiProperty({ example: '9:00 AM - 12:00 PM', nullable: true })
    delivery_time?: string;

    @ApiProperty({ example: '1000.00' })
    total_amount: string;

    @ApiProperty({ example: '500.00' })
    paid_amount: string;

    @ApiProperty({ example: 'PENDING', description: 'Estado de la orden (PENDING, DELIVERED, CANCELLED)' })
    status: string;

    @ApiProperty({ example: true, description: 'Indica si la orden requiere entrega a domicilio' })
    requires_delivery: boolean;

    @ApiProperty({ example: 'Cliente prefiere entrega por la mañana', nullable: true })
    notes?: string;

    @ApiProperty({ example: 'Av. Principal 123, Centro', nullable: true, description: 'Dirección de entrega específica para esta compra' })
    delivery_address?: string;

    @ApiProperty({ type: [OneOffPurchaseProductResponseDto] })
    products: OneOffPurchaseProductResponseDto[];

    @ApiProperty({ type: OneOffPurchasePersonResponseDto })
    person: OneOffPurchasePersonResponseDto;

    @ApiProperty({ type: OneOffPurchaseSaleChannelResponseDto })
    sale_channel: OneOffPurchaseSaleChannelResponseDto;

    @ApiProperty({ type: OneOffPurchaseLocalityResponseDto, nullable: true })
    locality?: OneOffPurchaseLocalityResponseDto;

    @ApiProperty({ type: OneOffPurchaseZoneResponseDto, nullable: true })
    zone?: OneOffPurchaseZoneResponseDto;
}