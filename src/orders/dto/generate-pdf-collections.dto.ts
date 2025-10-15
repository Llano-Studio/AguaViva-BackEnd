import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsArray,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '../../common/constants/enums';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeneratePdfCollectionsDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Fecha de inicio para el reporte (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Fecha de fin para el reporte (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  dateTo?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Fecha de vencimiento desde (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  dueDateFrom?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    description: 'Fecha de vencimiento hasta (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  dueDateTo?: string;

  @ApiPropertyOptional({
    description: 'Estados del pedido a incluir en el reporte',
    example: [OrderStatus.PENDING, OrderStatus.DELIVERED],
    enum: OrderStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      const statuses = value
        .split(',')
        .map((status) => status.trim())
        .filter((status) =>
          Object.values(OrderStatus).includes(status as OrderStatus),
        );
      return statuses.length > 0 ? statuses : undefined;
    }
    if (Array.isArray(value)) {
      const statuses = value.filter((status) =>
        Object.values(OrderStatus).includes(status),
      );
      return statuses.length > 0 ? statuses : undefined;
    }
    return undefined;
  })
  statuses?: OrderStatus[];

  @ApiPropertyOptional({
    description: 'Estados de pago a incluir en el reporte',
    example: [PaymentStatus.PENDING, PaymentStatus.PAID],
    enum: PaymentStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      const paymentStatuses = value
        .split(',')
        .map((status) => status.trim())
        .filter((status) =>
          Object.values(PaymentStatus).includes(status as PaymentStatus),
        );
      return paymentStatuses.length > 0 ? paymentStatuses : undefined;
    }
    if (Array.isArray(value)) {
      const paymentStatuses = value.filter((status) =>
        Object.values(PaymentStatus).includes(status),
      );
      return paymentStatuses.length > 0 ? paymentStatuses : undefined;
    }
    return undefined;
  })
  paymentStatuses?: PaymentStatus[];

  @ApiPropertyOptional({
    description: 'IDs de clientes específicos a incluir',
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
  customerIds?: number[];

  @ApiPropertyOptional({
    description: 'IDs de zonas específicas a incluir',
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
  @IsString()
  @ApiPropertyOptional({
    description: 'Incluir solo cobranzas vencidas (true/false)',
    example: 'false',
  })
  overdueOnly?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Monto mínimo a incluir',
    example: '100.00',
  })
  minAmount?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Monto máximo a incluir',
    example: '1000.00',
  })
  maxAmount?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Formato del reporte (summary, detailed)',
    example: 'detailed',
    enum: ['summary', 'detailed'],
  })
  reportFormat?: 'summary' | 'detailed';

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Título personalizado para el reporte',
    example: 'Reporte de Cobranzas Automáticas - Enero 2024',
  })
  reportTitle?: string;
}

export class PdfGenerationResponseDto {
  @ApiProperty({
    description: 'Indica si la generación fue exitosa',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Mensaje descriptivo del resultado',
    example: 'PDF generado exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'URL temporal para descargar el PDF',
    example: 'https://api.example.com/temp/collections-report-20240115-103045.pdf',
  })
  downloadUrl: string;

  @ApiProperty({
    description: 'Nombre del archivo PDF generado',
    example: 'collections-report-20240115-103045.pdf',
  })
  fileName: string;

  @ApiProperty({
    description: 'Tamaño del archivo en bytes',
    example: 245760,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Tiempo de expiración de la URL (en minutos)',
    example: 60,
  })
  expirationMinutes: number;

  @ApiProperty({
    description: 'Estadísticas del reporte generado',
    type: 'object',
    properties: {
      total_records: { type: 'number', example: 150 },
      total_amount: { type: 'string', example: '15000.00' },
      total_pending: { type: 'string', example: '10000.00' },
      overdue_count: { type: 'number', example: 25 },
      overdue_amount: { type: 'string', example: '3500.00' },
    },
  })
  reportStats: {
    total_records: number;
    total_amount: string;
    total_pending: string;
    overdue_count: number;
    overdue_amount: string;
  };
}