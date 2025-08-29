import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { IsOptional, IsString, IsArray } from 'class-validator';

export class CustomerResponseDto {
  @ApiProperty({
    description: 'ID del cliente',
    example: 1
  })
  person_id: number;

  @ApiProperty({
    description: 'Nombre del cliente',
    example: 'Juan Pérez'
  })
  name: string;

  @ApiProperty({
    description: 'Teléfono del cliente',
    example: '+541155556666'
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Dirección del cliente',
    example: 'Av. Rivadavia 1234'
  })
  address?: string;

  @ApiPropertyOptional({
    description: 'Información de la zona del cliente'
  })
  zone?: {
    zone_id: number;
    name: string;
    locality: {
      locality_id: number;
      name: string;
    };
  };
}

export class SubscriptionPlanResponseDto {
  @ApiProperty({
    description: 'ID del plan de suscripción',
    example: 1
  })
  subscription_plan_id: number;

  @ApiProperty({
    description: 'Nombre del plan',
    example: 'Plan Básico Mensual'
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Descripción del plan',
    example: 'Incluye entrega mensual de productos básicos'
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Precio del plan',
    example: '1500.00'
  })
  price?: string;
}

export class SubscriptionCycleResponseDto {
  @ApiProperty({
    description: 'ID del ciclo',
    example: 1
  })
  cycle_id: number;

  @ApiProperty({
    description: 'Fecha de inicio del ciclo',
    example: '2024-01-01'
  })
  cycle_start: string;

  @ApiProperty({
    description: 'Fecha de fin del ciclo',
    example: '2024-01-31'
  })
  cycle_end: string;

  @ApiPropertyOptional({
    description: 'Notas del ciclo',
    example: 'Primer ciclo de la suscripción'
  })
  notes?: string;
}

export class DeliveryPreferences {
  @ApiProperty({ 
    example: "09:00-12:00", 
    description: 'Rango de tiempo preferido para entregas',
    required: false
  })
  @IsOptional()
  @IsString()
  preferred_time_range?: string;

  @ApiProperty({ 
    example: ["MONDAY", "WEDNESDAY", "FRIDAY"], 
    description: 'Días preferidos de la semana',
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferred_days?: string[];

  @ApiProperty({ 
    example: ["12:00-13:00"], 
    description: 'Horarios a evitar',
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avoid_times?: string[];

  @ApiProperty({ 
    example: "Llamar antes de llegar", 
    description: 'Instrucciones especiales',
    required: false
  })
  @IsOptional()
  @IsString()
  special_instructions?: string;
}

export class CustomerSubscriptionResponseDto {
  @ApiProperty({ example: 1 })
  subscription_id: number;

  @ApiProperty({ example: 1 })
  customer_id: number;

  @ApiProperty({ example: 1 })
  subscription_plan_id: number;

  @ApiProperty({ example: '2024-01-01' })
  start_date: string;

  // end_date field removed - not present in schema

  @ApiProperty({ example: '2024-01-15', required: false })
  collection_date?: string;

  @ApiProperty({ enum: SubscriptionStatus, example: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @ApiProperty({ 
    example: 'Cliente VIP - entrega prioritaria', 
    required: false 
  })
  notes?: string;

  @ApiProperty({ 
    type: DeliveryPreferences,
    description: 'Preferencias de horario de entrega extraídas de notes',
    required: false
  })
  delivery_preferences?: DeliveryPreferences;

  // Relaciones incluidas
  @ApiProperty({ required: false })
  subscription_plan?: {
    name: string;
    description?: string;
    price?: number;
  };

  @ApiProperty({ required: false })
  customer?: {
    name?: string;
    phone: string;
    address?: string;
  };

  constructor(partial: Partial<any>) {
    Object.assign(this, partial);
    
    // Convert dates to strings
    if (partial.start_date instanceof Date) {
      this.start_date = partial.start_date.toISOString().split('T')[0];
    }
    // end_date field removed - not present in schema
    
    // Handle null values
    if (partial.notes === null) {
      this.notes = undefined;
    }
    // end_date field removed - not present in schema
  }
}

export class PaginatedCustomerSubscriptionResponseDto {
  @ApiProperty({ 
    type: [CustomerSubscriptionResponseDto],
    description: 'Lista de suscripciones de clientes'
  })
  data: CustomerSubscriptionResponseDto[];

  @ApiProperty({
    type: 'object',
    properties: {
      total: { type: 'number', example: 100, description: 'Total de suscripciones disponibles' },
      page: { type: 'number', example: 1, description: 'Número de la página actual' },
      limit: { type: 'number', example: 10, description: 'Número de suscripciones por página' },
      totalPages: { type: 'number', example: 10, description: 'Total de páginas disponibles' }
    }
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}