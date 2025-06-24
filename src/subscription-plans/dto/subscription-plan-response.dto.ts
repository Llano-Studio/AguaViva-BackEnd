import { ApiProperty } from '@nestjs/swagger';

// DTO para un producto dentro de un plan de suscripción
export class SubscriptionPlanProductResponseDto {
  @ApiProperty({ description: 'ID del producto', example: 1 })
  product_id: number;

  @ApiProperty({ description: 'Nombre/descripción del producto', example: 'Agua Purificada 20L' })
  product_description: string; // Asumiendo que obtenemos la descripción del producto

  @ApiProperty({ description: 'Código del producto', example: 'AGP20L', required: false })
  product_code?: string;

  @ApiProperty({ description: 'Cantidad del producto incluida en el plan', example: 4 })
  quantity: number;
}

// DTO para la respuesta de un plan de suscripción individual
export class SubscriptionPlanResponseDto {
  @ApiProperty({ description: 'ID del plan de suscripción', example: 1, type: 'integer' })
  subscription_plan_id: number;

  @ApiProperty({ description: 'Nombre del plan de suscripción', example: 'Plan Familiar Mensual' })
  name: string;

  @ApiProperty({ description: 'Descripción detallada del plan', example: 'Entrega mensual de 4 bidones de 20L.', required: false })
  description?: string;

  @ApiProperty({ description: 'Precio del plan', example: 1200.50, type: 'number', format: 'float' })
  price: number; // Prisma Decimal se convertirá a number

  @ApiProperty({ description: 'Duración por defecto del ciclo del plan en días (valor por defecto para nuevas suscripciones)', example: 30, type: 'integer' })
  default_cycle_days: number;

  @ApiProperty({ description: 'Número por defecto de entregas por ciclo (valor por defecto para nuevas suscripciones)', example: 1, type: 'integer' })
  default_deliveries_per_cycle: number;

  @ApiProperty({ description: 'Indica si el plan está activo y disponible para nuevas suscripciones', example: true })
  is_active: boolean;
  
  @ApiProperty({ description: 'Fecha de creación del plan', type: Date })
  created_at: Date;

  @ApiProperty({ description: 'Fecha de última actualización del plan', type: Date })
  updated_at: Date;

  @ApiProperty({ 
    description: 'Lista de productos incluidos en el plan', 
    type: [SubscriptionPlanProductResponseDto], 
    required: false 
  })
  products?: SubscriptionPlanProductResponseDto[];
}

// DTO para la respuesta paginada de planes de suscripción
export class PaginatedSubscriptionPlanResponseDto {
  @ApiProperty({ type: [SubscriptionPlanResponseDto] })
  data: SubscriptionPlanResponseDto[];

  @ApiProperty({
    type: 'object',
    properties: {
      total: { type: 'number', example: 50, description: 'Total de planes de suscripción disponibles' },
      page: { type: 'number', example: 1, description: 'Número de la página actual' },
      limit: { type: 'number', example: 10, description: 'Número de planes de suscripción por página' },
      totalPages: { type: 'number', example: 5, description: 'Total de páginas disponibles' }
    }
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
} 