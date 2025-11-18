import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateRouteSheetDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Fecha específica para la hoja de ruta (YYYY-MM-DD). Si no se especifica, se usa la fecha actual',
    example: '2024-01-15',
  })
  date?: string;

  @ApiPropertyOptional({
    description: 'IDs de zonas específicas para la hoja de ruta',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      const ids = value
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    if (Array.isArray(value)) {
      const ids = value.map((id) => parseInt(id)).filter((id) => !isNaN(id));
      return ids.length > 0 ? ids : undefined;
    }
    return undefined;
  })
  zoneIds?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({
    description: 'ID del conductor asignado',
    type: Number,
    example: 1,
  })
  driverId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @ApiPropertyOptional({
    description: 'ID del vehículo asignado',
    type: Number,
    example: 1,
  })
  vehicleId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Prioridad de las cobranzas (overdue, all)',
    example: 'overdue',
    enum: ['overdue', 'all'],
  })
  priority?: 'overdue' | 'all';

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Ordenamiento de las cobranzas (zone, amount, due_date)',
    example: 'zone',
    enum: ['zone', 'amount', 'due_date'],
  })
  sortBy?: 'zone' | 'amount' | 'due_date';

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Incluir solo cobranzas vencidas (true/false)',
    example: 'false',
  })
  overdueOnly?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Monto mínimo de cobranza a incluir',
    example: '50.00',
  })
  minAmount?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Formato de la hoja de ruta (compact, detailed)',
    example: 'detailed',
    enum: ['compact', 'detailed'],
  })
  format?: 'compact' | 'detailed';

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Notas adicionales para la hoja de ruta',
    example: 'Priorizar cobranzas vencidas en zona centro',
  })
  notes?: string;
}

export class RouteSheetDriverDto {
  @ApiProperty({
    description: 'ID del conductor',
    example: 1,
  })
  driver_id: number;

  @ApiProperty({
    description: 'Nombre completo del conductor',
    example: 'Carlos Rodríguez',
  })
  name: string;

  @ApiProperty({
    description: 'Número de licencia de conducir',
    example: 'B1234567',
    nullable: true,
  })
  license_number?: string;

  @ApiProperty({
    description: 'Teléfono del conductor',
    example: '+54 9 11 9876-5432',
    nullable: true,
  })
  phone?: string;
}

export class RouteSheetVehicleDto {
  @ApiProperty({
    description: 'ID del vehículo',
    example: 1,
  })
  vehicle_id: number;

  @ApiProperty({
    description: 'Patente del vehículo',
    example: 'ABC123',
  })
  license_plate: string;

  @ApiProperty({
    description: 'Marca y modelo del vehículo',
    example: 'Ford Transit 2020',
    nullable: true,
  })
  model?: string;

  @ApiProperty({
    description: 'Capacidad de carga en litros',
    example: 2000,
    nullable: true,
  })
  capacity?: number;
}

export class RouteSheetCollectionDto {
  @ApiProperty({
    description: 'ID del pedido de cobranza',
    example: 123,
  })
  order_id: number;

  @ApiProperty({
    description: 'Información del cliente',
    type: 'object',
    properties: {
      customer_id: { type: 'number', example: 1 },
      name: { type: 'string', example: 'Juan Pérez' },
      address: { type: 'string', example: 'Av. Principal 123' },
      phone: { type: 'string', example: '+54 9 11 1234-5678' },
      zone_name: { type: 'string', example: 'Centro' },
    },
  })
  customer: {
    customer_id: number;
    name: string;
    address: string;
    phone?: string;
    zone_name: string;
  };

  @ApiProperty({
    description: 'Monto a cobrar',
    example: '150.00',
  })
  amount: string;

  @ApiProperty({
    description: 'Fecha de vencimiento',
    example: '2024-01-20T00:00:00Z',
    nullable: true,
  })
  due_date?: string;

  @ApiProperty({
    description: 'Días de atraso',
    example: 5,
  })
  days_overdue: number;

  @ApiProperty({
    description: 'Prioridad de cobranza (1=alta, 2=media, 3=baja)',
    example: 1,
  })
  priority: number;

  @ApiProperty({
    description: 'Notas de la cobranza',
    example: 'COBRANZA AUTOMÁTICA - Plan Familiar Mensual',
    nullable: true,
  })
  notes?: string;

  @ApiProperty({
    description: 'Estado de la cobranza',
    example: 'PENDING',
  })
  status: string;

  @ApiProperty({
    description: 'Indica si la orden pertenece a backlog (pendiente/atrasada)',
    example: false,
  })
  is_backlog: boolean;

  @ApiProperty({
    description: 'Tipo de backlog si aplica',
    example: 'OVERDUE',
    nullable: true,
  })
  backlog_type?: 'PENDING' | 'OVERDUE' | null;
}

export class RouteSheetZoneDto {
  @ApiProperty({
    description: 'ID de la zona',
    example: 1,
  })
  zone_id: number;

  @ApiProperty({
    description: 'Nombre de la zona',
    example: 'Centro',
  })
  name: string;

  @ApiProperty({
    description: 'Cobranzas en esta zona',
    type: [RouteSheetCollectionDto],
  })
  collections: RouteSheetCollectionDto[];

  @ApiProperty({
    description: 'Resumen de la zona',
    type: 'object',
    properties: {
      total_collections: { type: 'number', example: 15 },
      total_amount: { type: 'string', example: '2250.00' },
      overdue_collections: { type: 'number', example: 5 },
      overdue_amount: { type: 'string', example: '750.00' },
    },
  })
  summary: {
    total_collections: number;
    total_amount: string;
    overdue_collections: number;
    overdue_amount: string;
  };
}

export class RouteSheetResponseDto {
  @ApiProperty({
    description: 'Indica si la generación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'Hoja de ruta generada exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'URL temporal para descargar la hoja de ruta',
    example: 'https://api.example.com/temp/route-sheet-20240115-103045.pdf',
  })
  downloadUrl: string;

  @ApiProperty({
    description: 'Información de la hoja de ruta',
    type: 'object',
    properties: {
      date: { type: 'string', example: '2024-01-15' },
      generated_at: { type: 'string', example: '2024-01-15T10:30:45Z' },
      driver: { type: 'object', additionalProperties: true },
      vehicle: { type: 'object', additionalProperties: true },
      zones: { type: 'array', items: { type: 'object' } },
    },
  })
  routeSheet: {
    date: string;
    generated_at: string;
    driver?: RouteSheetDriverDto;
    vehicle?: RouteSheetVehicleDto;
    zones: RouteSheetZoneDto[];
    summary: {
      total_zones: number;
      total_collections: number;
      total_amount: string;
      overdue_collections: number;
      overdue_amount: string;
      estimated_duration_hours: number;
    };
    notes?: string;
  };
}