import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalCatalogPriceListDto {
  @ApiProperty({ example: 1 })
  price_list_id: number;

  @ApiProperty({ example: 'Lista de Precios General' })
  name: string;
}

export class PortalCatalogProductDto {
  @ApiProperty({ example: 1 })
  product_id: number;

  @ApiProperty({ example: 'RECARGA DE 20 LITROS' })
  description: string;

  @ApiPropertyOptional({ nullable: true, example: '20.00' })
  volume_liters: string | null;

  @ApiProperty({ description: 'Envase retornable' })
  is_returnable: boolean;

  @ApiPropertyOptional({ nullable: true })
  image_url: string | null;

  @ApiProperty({
    description: 'Precio unitario para este cliente',
    example: '2100.00',
  })
  unit_price: string;

  @ApiProperty({ description: 'Lista de la que sale el precio', example: 1 })
  price_list_id: number;
}

export class PortalSubscriptionQuotaDto {
  @ApiProperty({ example: 1 })
  product_id: number;

  @ApiProperty({ example: 'RECARGA DE 20 LITROS' })
  description: string;

  @ApiProperty({ description: 'Unidades incluidas en el ciclo', example: 8 })
  planned_quantity: number;

  @ApiProperty({
    description: 'Unidades ya entregadas o pedidas en el ciclo',
    example: 3,
  })
  delivered_quantity: number;

  @ApiProperty({
    description: 'Unidades que todavía cubre el abono sin cargo',
    example: 5,
  })
  remaining_balance: number;
}

export class PortalSubscriptionDto {
  @ApiProperty({ example: 6 })
  subscription_id: number;

  @ApiProperty({ example: 'Abono Familiar' })
  plan_name: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Inicio del ciclo vigente (YYYY-MM-DD)',
  })
  cycle_start: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Fin del ciclo vigente (YYYY-MM-DD)',
  })
  cycle_end: string | null;

  @ApiProperty({
    type: [PortalSubscriptionQuotaDto],
    description:
      'Cuota del ciclo vigente. Vacía si todavía no hay ciclo abierto.',
  })
  quotas: PortalSubscriptionQuotaDto[];
}

export class PortalCatalogResponseDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Contrato vigente del cliente, si tiene',
  })
  contract_id: number | null;

  @ApiProperty({
    type: [PortalCatalogPriceListDto],
    description: 'Listas de precios aplicadas al cliente',
  })
  price_lists: PortalCatalogPriceListDto[];

  @ApiProperty({ type: [PortalCatalogProductDto] })
  products: PortalCatalogProductDto[];

  @ApiProperty({
    type: [PortalSubscriptionDto],
    description:
      'Abonos activos del cliente. Los productos cubiertos por la cuota se cobran $0 al pedir; el excedente se cobra a precio de lista.',
  })
  subscriptions: PortalSubscriptionDto[];
}
