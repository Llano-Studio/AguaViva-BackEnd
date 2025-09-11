import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  FirstCycleComodatoService,
  FirstCycleComodatoResult,
} from '../services/first-cycle-comodato.service';

export class ProcessFirstCycleDto {
  subscription_id: number;
  delivery_date: string; // YYYY-MM-DD format
}

@ApiTags('First Cycle Comodato')
@Controller('first-cycle-comodato')
export class FirstCycleComodatoController {
  constructor(
    private readonly firstCycleComodatoService: FirstCycleComodatoService,
  ) {}

  @Post('process')
  @ApiOperation({
    summary: 'Procesar comodato automático para primer ciclo',
    description: `
    Verifica si es el primer ciclo de una suscripción y crea automáticamente 
    comodatos para todos los productos retornables del plan.
    
    **Funcionalidad:**
    - Verifica si es el primer ciclo de la suscripción
    - Identifica productos retornables en el plan de suscripción
    - Crea comodatos automáticamente para productos retornables
    - Evita duplicados verificando comodatos existentes
    - Establece fecha de devolución esperada (1 año después)
    - Sin depósito ni cuota mensual en primer ciclo
    `,
  })
  @ApiBody({
    description: 'Datos para procesar el primer ciclo',
    schema: {
      type: 'object',
      properties: {
        subscription_id: {
          type: 'number',
          example: 1,
          description: 'ID de la suscripción',
        },
        delivery_date: {
          type: 'string',
          format: 'date',
          example: '2024-01-15',
          description: 'Fecha de entrega en formato YYYY-MM-DD',
        },
      },
      required: ['subscription_id', 'delivery_date'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Proceso de comodato completado exitosamente',
    schema: {
      type: 'object',
      properties: {
        comodatos_created: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              comodato_id: { type: 'number', example: 1 },
              product_id: { type: 'number', example: 5 },
              product_description: { type: 'string', example: 'Bidón 20L' },
              quantity: { type: 'number', example: 2 },
              delivery_date: { type: 'string', example: '2024-01-15' },
            },
          },
        },
        total_comodatos: { type: 'number', example: 2 },
        is_first_cycle: { type: 'boolean', example: true },
        customer_id: { type: 'number', example: 123 },
        subscription_id: { type: 'number', example: 1 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada',
  })
  async processFirstCycle(
    @Body() dto: ProcessFirstCycleDto,
  ): Promise<FirstCycleComodatoResult> {
    const deliveryDate = new Date(dto.delivery_date);
    return await this.firstCycleComodatoService.processFirstCycleComodato(
      dto.subscription_id,
      deliveryDate,
    );
  }

  @Get('subscription/:subscriptionId/summary')
  @ApiOperation({
    summary: 'Obtener resumen de comodatos para una suscripción',
    description: `
    Obtiene un resumen completo de los comodatos activos para una suscripción específica,
    incluyendo información sobre si es el primer ciclo.
    `,
  })
  @ApiParam({
    name: 'subscriptionId',
    description: 'ID de la suscripción',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen de comodatos obtenido exitosamente',
    schema: {
      type: 'object',
      properties: {
        subscription_id: { type: 'number', example: 1 },
        customer_id: { type: 'number', example: 123 },
        customer_name: { type: 'string', example: 'Juan Pérez' },
        is_first_cycle: { type: 'boolean', example: true },
        active_comodatos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              comodato_id: { type: 'number', example: 1 },
              product_id: { type: 'number', example: 5 },
              product_description: { type: 'string', example: 'Bidón 20L' },
              quantity: { type: 'number', example: 2 },
              delivery_date: { type: 'string', example: '2024-01-15' },
              expected_return_date: { type: 'string', example: '2025-01-15' },
              notes: {
                type: 'string',
                example: 'Comodato automático - Primer ciclo',
              },
            },
          },
        },
        total_active_comodatos: { type: 'number', example: 2 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Suscripción no encontrada',
  })
  async getComodatoSummary(
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
  ) {
    return await this.firstCycleComodatoService.getComodatoSummaryBySubscription(
      subscriptionId,
    );
  }

  @Get('customer/:customerId/active')
  @ApiOperation({
    summary: 'Obtener comodatos activos de un cliente',
    description: `
    Obtiene todos los comodatos activos para un cliente específico.
    `,
  })
  @ApiParam({
    name: 'customerId',
    description: 'ID del cliente',
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de comodatos activos obtenida exitosamente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          comodato_id: { type: 'number', example: 1 },
          person_id: { type: 'number', example: 123 },
          product_id: { type: 'number', example: 5 },
          quantity: { type: 'number', example: 2 },
          delivery_date: {
            type: 'string',
            example: '2024-01-15T00:00:00.000Z',
          },
          expected_return_date: {
            type: 'string',
            example: '2025-01-15T00:00:00.000Z',
          },
          status: { type: 'string', example: 'ACTIVE' },
          notes: {
            type: 'string',
            example: 'Comodato automático - Primer ciclo',
          },
          product: {
            type: 'object',
            properties: {
              product_id: { type: 'number', example: 5 },
              description: { type: 'string', example: 'Bidón 20L' },
              is_returnable: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  async getActiveComodatosByCustomer(
    @Param('customerId', ParseIntPipe) customerId: number,
  ) {
    return await this.firstCycleComodatoService.getActiveComodatosByCustomer(
      customerId,
    );
  }

  @Get('customer/:customerId/product/:productId/has-active')
  @ApiOperation({
    summary: 'Verificar si cliente tiene comodato activo para un producto',
    description: `
    Verifica si un cliente específico ya tiene un comodato activo para un producto determinado.
    Útil para evitar duplicados antes de crear nuevos comodatos.
    `,
  })
  @ApiParam({
    name: 'customerId',
    description: 'ID del cliente',
    example: 123,
  })
  @ApiParam({
    name: 'productId',
    description: 'ID del producto',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Verificación completada',
    schema: {
      type: 'object',
      properties: {
        has_active_comodato: { type: 'boolean', example: true },
        customer_id: { type: 'number', example: 123 },
        product_id: { type: 'number', example: 5 },
      },
    },
  })
  async hasActiveComodatoForProduct(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    const hasActive =
      await this.firstCycleComodatoService.hasActiveComodatoForProduct(
        customerId,
        productId,
      );

    return {
      has_active_comodato: hasActive,
      customer_id: customerId,
      product_id: productId,
    };
  }
}
