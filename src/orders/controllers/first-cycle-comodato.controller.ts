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
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  FirstCycleComodatoService,
  FirstCycleComodatoResult,
} from '../../common/services/first-cycle-comodato.service';
import { Auth } from '../../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

export class ProcessFirstCycleDto {
  subscription_id: number;
  delivery_date: string; // YYYY-MM-DD format
}

@ApiTags('Ciclos de Comodatos')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
@Controller('first-cycle-comodato')
export class FirstCycleComodatoController {
  constructor(
    private readonly firstCycleComodatoService: FirstCycleComodatoService,
  ) {}

  @Post('process')
  @ApiOperation({
    summary: 'Procesar comodato automático para primer ciclo de suscripción',
    description: `Gestiona automáticamente la creación de comodatos cuando un cliente inicia su primera suscripción.

## 🎯 COMODATO DE PRIMER CICLO

**Proceso Automático:**
- Verifica si es el primer ciclo de la suscripción
- Identifica productos retornables en el plan
- Crea comodatos automáticamente sin depósito
- Establece fecha de devolución esperada (1 año)
- Evita duplicados verificando comodatos existentes

## 📦 PRODUCTOS ELEGIBLES

**Criterios de Comodato:**
- Solo productos marcados como retornables
- Productos incluidos en el plan de suscripción
- Bidones, dispensadores y accesorios
- Exclusión de productos consumibles

## 💰 CONDICIONES ESPECIALES

**Primer Ciclo:**
- **Sin depósito**: No se cobra depósito inicial
- **Sin cuota mensual**: Comodato gratuito
- **Período extendido**: 1 año de plazo
- **Renovación automática**: Con suscripciones activas

## 🔄 VALIDACIONES AUTOMÁTICAS

- Verificación de primer ciclo
- Prevención de comodatos duplicados
- Validación de productos retornables
- Control de fechas y plazos`,
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
          return_date: {
            type: 'string',
            example: null,
            nullable: true,
          },
          expected_return_date: {
            type: 'string',
            example: '2025-01-15T00:00:00.000Z',
          },
          status: { type: 'string', example: 'ACTIVE' },
          notes: {
            type: 'string',
            example: 'Comodato automático - Primer ciclo de suscripción 1',
          },
          deposit_amount: { type: 'string', example: '0' },
          monthly_fee: { type: 'string', example: '0' },
          article_description: { type: 'string', example: 'Bidón 20L' },
          brand: { type: 'string', example: '' },
          model: { type: 'string', example: '' },
          contract_image_path: {
            type: 'string',
            example:
              'http://localhost:3000/public/uploads/contracts/contract_123_456.jpg',
            nullable: true,
          },
          created_at: {
            type: 'string',
            example: '2024-01-15T10:30:00.000Z',
          },
          updated_at: {
            type: 'string',
            example: '2024-01-15T10:30:00.000Z',
          },
          is_active: { type: 'boolean', example: true },
          product: {
            type: 'object',
            properties: {
              product_id: { type: 'number', example: 5 },
              description: { type: 'string', example: 'Bidón 20L' },
              is_returnable: { type: 'boolean', example: true },
            },
          },
          subscription: {
            type: 'object',
            nullable: true,
            properties: {
              subscription_id: { type: 'number', example: 1 },
              subscription_name: { type: 'string', example: 'Plan Básico' },
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
