import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '../../common/constants/enums';

export class OneOffPurchaseProductResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID del producto comprado',
  })
  product_id: number;

  @ApiProperty({
    example: 'Agua Bidón 20L',
    description: 'Descripción del producto',
  })
  description: string;

  @ApiProperty({
    example: 2,
    description: 'Cantidad del producto comprado',
  })
  quantity: number;

  @ApiProperty({
    example: '5000.00',
    description: 'Precio unitario aplicado al producto',
  })
  unit_price: string;

  @ApiProperty({
    example: '10000.00',
    description: 'Subtotal del ítem (precio unitario × cantidad)',
  })
  subtotal: string;

  @ApiProperty({
    example: 1,
    description: 'ID de la lista de precios utilizada',
    nullable: true,
  })
  price_list_id?: number;
}

export class OneOffPurchasePersonResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID único del cliente que realizó la compra',
  })
  person_id: number;

  @ApiProperty({
    example: 'Cliente Ocasional',
    description: 'Nombre completo del cliente',
  })
  name: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Número de teléfono principal del cliente para contacto',
  })
  phone: string;

  @ApiProperty({
    example: 'Av. Principal 123, Centro',
    nullable: true,
    description: 'Dirección registrada del cliente en el sistema',
  })
  address?: string;
}

export class OneOffPurchaseSaleChannelResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID único del canal de venta utilizado',
  })
  sale_channel_id: number;

  @ApiProperty({
    example: 'Venta Directa',
    description:
      'Nombre del canal de venta (ej: Venta Directa, Tienda Online, WhatsApp)',
  })
  name: string;
}

export class OneOffPurchaseLocalityResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID único de la localidad del cliente',
  })
  locality_id: number;

  @ApiProperty({
    example: 'Centro',
    description: 'Nombre de la localidad donde reside el cliente',
  })
  name: string;
}

export class OneOffPurchaseZoneResponseDto {
  @ApiProperty({
    example: 1,
    description: 'ID único de la zona de entrega asignada',
  })
  zone_id: number;

  @ApiProperty({
    example: 'Zona 1',
    description: 'Nombre de la zona geográfica para planificación de entregas',
  })
  name: string;
}

export class OneOffPurchaseResponseDto {
  @ApiProperty({ 
    example: 1, 
    description: `ID genérico de la compra para referencia general.
    
⚠️ IMPORTANTE: NO usar este campo para crear hojas de ruta.
Use purchase_type para determinar qué ID específico usar.` 
  })
  purchase_id: number;

  @ApiPropertyOptional({ 
    example: 5, 
    description: `🔹 ID de la tabla one_off_purchase (compras de UN SOLO producto).
    
✅ CUÁNDO USAR:
- Solo presente cuando purchase_type = "LEGACY"
- Usar este campo en hojas de ruta: { "one_off_purchase_id": 5, ... }

❌ NO USAR si purchase_type = "HEADER"

📋 EJEMPLO DE USO EN HOJA DE RUTA:
{
  "details": [
    {
      "one_off_purchase_id": 5,
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }
  ]
}` 
  })
  one_off_purchase_id?: number;

  @ApiPropertyOptional({ 
    example: 3, 
    description: `🔹 ID de la tabla one_off_purchase_header (compras de MÚLTIPLES productos).
    
✅ CUÁNDO USAR:
- Solo presente cuando purchase_type = "HEADER"
- Usar este campo en hojas de ruta: { "one_off_purchase_header_id": 3, ... }

❌ NO USAR si purchase_type = "LEGACY"

📋 EJEMPLO DE USO EN HOJA DE RUTA:
{
  "details": [
    {
      "one_off_purchase_header_id": 3,
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }
  ]
}` 
  })
  purchase_header_id?: number;

  @ApiPropertyOptional({ 
    example: 'HEADER', 
    enum: ['LEGACY', 'HEADER'],
    description: `🎯 CAMPO CLAVE para determinar qué ID usar en hojas de ruta.

📊 TIPOS:
- "LEGACY": Compra de UN SOLO producto → Usar one_off_purchase_id
- "HEADER": Compra de MÚLTIPLES productos → Usar purchase_header_id

✅ LÓGICA FRONTEND:
\`\`\`javascript
if (purchase.purchase_type === 'LEGACY') {
  // Usar one_off_purchase_id
  routeDetail = {
    one_off_purchase_id: purchase.one_off_purchase_id,
    delivery_status: "PENDING",
    delivery_time: "08:00-12:00"
  };
} else if (purchase.purchase_type === 'HEADER') {
  // Usar purchase_header_id
  routeDetail = {
    one_off_purchase_header_id: purchase.purchase_header_id,
    delivery_status: "PENDING",
    delivery_time: "08:00-12:00"
  };
}
\`\`\`

📋 EJEMPLO COMPLETO:
Respuesta del API:
{
  "purchase_id": 4,
  "purchase_header_id": 4,
  "purchase_type": "HEADER",  ← Usar este campo
  "person_id": 10,
  ...
}

Payload para hoja de ruta:
{
  "details": [
    {
      "one_off_purchase_header_id": 4,  ← Usar purchase_header_id porque es HEADER
      "delivery_status": "PENDING",
      "delivery_time": "08:00-12:00"
    }
  ]
}` 
  })
  purchase_type?: string;

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

  @ApiProperty({
    example: 'PENDING',
    description: 'Estado de la orden (PENDING, DELIVERED, CANCELLED)',
  })
  status: string;

  @ApiProperty({
    description: 'Tipo de orden',
    enum: OrderType,
    example: OrderType.ONE_OFF,
  })
  order_type: OrderType;

  @ApiProperty({
    example: 'green',
    description:
      'Sistema de semáforos: green (<5 días), yellow (5-10 días), red (>10 días)',
  })
  traffic_light_status: string;

  @ApiProperty({
    example: true,
    description: 'Indica si la orden requiere entrega a domicilio',
  })
  requires_delivery: boolean;

  @ApiProperty({
    example: 'Cliente prefiere entrega por la mañana',
    nullable: true,
  })
  notes?: string;

  @ApiProperty({
    example: 'Av. Principal 123, Centro',
    nullable: true,
    description: 'Dirección de entrega específica para esta compra',
  })
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

  @ApiProperty({
    example: 'PENDING',
    description: 'Estado de pago (NONE, PENDING, PARTIAL, PAID)',
  })
  payment_status: string;

  @ApiProperty({
    example: '500.00',
    description: 'Monto restante por pagar',
  })
  remaining_amount: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        payment_id: { type: 'number', example: 1 },
        amount: { type: 'string', example: '500.00' },
        payment_date: { type: 'string', example: '2024-03-25T10:00:00Z' },
        payment_method: { type: 'string', example: 'Efectivo' },
        transaction_reference: { type: 'string', example: 'TXN-123456' },
        notes: { type: 'string', example: 'Pago parcial' },
      },
    },
    description: 'Historial de pagos realizados',
  })
  payments: Array<{
    payment_id: number;
    amount: string;
    payment_date: string;
    payment_method: string;
    transaction_reference?: string;
    notes?: string;
  }>;
}
