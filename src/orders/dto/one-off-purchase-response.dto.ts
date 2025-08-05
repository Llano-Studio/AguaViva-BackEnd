import { ApiProperty } from '@nestjs/swagger';

export class OneOffPurchaseProductResponseDto {
    @ApiProperty({ example: 1 })
    product_id: number;
    @ApiProperty({ example: 'Agua Bidón 20L' })
    description: string;
    @ApiProperty({ example: '500.00' })
    price: string;
}

export class OneOffPurchasePersonResponseDto {
    @ApiProperty({ example: 1 })
    person_id: number;
    @ApiProperty({ example: 'Cliente Ocasional' })
    name: string;
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
    product_id: number;

    @ApiProperty({ example: 1 })
    person_id: number;

    @ApiProperty({ example: 2 })
    quantity: number;

    @ApiProperty({ example: 1 })
    sale_channel_id: number;

    @ApiProperty({ example: 1, nullable: true })
    locality_id?: number;

    @ApiProperty({ example: 1, nullable: true })
    zone_id?: number;

    @ApiProperty({ example: '2024-03-25T10:00:00Z' })
    purchase_date: string;

    @ApiProperty({ example: '2024-03-26T14:00:00Z', nullable: true })
    scheduled_delivery_date?: string;

    @ApiProperty({ example: '9:00 AM - 12:00 PM', nullable: true })
    delivery_time?: string;

    @ApiProperty({ example: '1000.00' })
    total_amount: string;

    @ApiProperty({ type: OneOffPurchaseProductResponseDto })
    product: OneOffPurchaseProductResponseDto;

    @ApiProperty({ type: OneOffPurchasePersonResponseDto })
    person: OneOffPurchasePersonResponseDto;

    @ApiProperty({ type: OneOffPurchaseSaleChannelResponseDto })
    sale_channel: OneOffPurchaseSaleChannelResponseDto;

    @ApiProperty({ type: OneOffPurchaseLocalityResponseDto, nullable: true })
    locality?: OneOffPurchaseLocalityResponseDto;

    @ApiProperty({ type: OneOffPurchaseZoneResponseDto, nullable: true })
    zone?: OneOffPurchaseZoneResponseDto;
}