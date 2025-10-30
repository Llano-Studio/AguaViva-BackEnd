import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('💚 Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Verificar estado operativo de la API Sgarav',
    description:
      'Endpoint básico para verificar que la API está funcionando correctamente y responde a las solicitudes.',
  })
  @ApiResponse({
    status: 200,
    description: 'API operativa y funcionando correctamente',
    schema: {
      type: 'string',
      example: 'API Sgarav funcionando correctamente',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Verificar estado de salud completo del sistema',
    description:
      'Endpoint de health check que verifica el estado de la API, base de datos y servicios críticos del sistema Sgarav.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de salud de la API',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2023-07-01T12:00:00Z' },
        database: { type: 'boolean', example: true },
        uptime: { type: 'number', example: 3600 },
      },
    },
  })
  async checkHealth() {
    return this.appService.checkHealth();
  }

  @Get('pricing-system-docs')
  @ApiOperation({
    summary: 'Documentación del Sistema de Precios Diferenciados',
    description: `Documentación completa del sistema de precios diferenciados implementado en la API.

# Sistema de Precios Diferenciados

## Resumen General

El sistema permite diferentes precios para los mismos productos según el tipo de transacción y cliente:

### 1. **Contratos (client_contract)**
- **Flujo**: \`client_contract.price_list_id → price_list_item.unit_price → product.price\` (fallback)
- **Uso**: Clientes con contratos específicos que tienen listas de precios personalizadas
- **Endpoint**: \`POST /api/orders\` (con \`contract_id\`)

### 2. **Compras Únicas (one_off_purchase)**
- **Flujo**: \`Lista General (ID: 1) → price_list_item.unit_price → product.price\` (fallback)
- **Uso**: Clientes ocasionales sin contrato, usan la lista estándar/pública
- **Endpoint**: \`POST /api/one-off-purchases/one-off\`

### 3. **Suscripciones (customer_subscription)**
- **Flujo**: \`subscription_plan.price\` (precio fijo del paquete)
- **Uso**: Planes de suscripción con precio cerrado, NO usan listas de precios
- **Endpoint**: \`POST /api/customer-subscriptions\`

## Entidades Principales

### price_list
- Contiene las diferentes listas de precios del sistema
- Lista General/Estándar (ID: 1) para compras públicas
- Listas específicas para contratos

### price_list_item
- Precios específicos de cada producto en cada lista
- Permite tener diferentes precios del mismo producto según la lista

### product
- Campo \`price\`: Precio base/referencia que sirve como fallback
- Al crear productos se agregan automáticamente a la Lista General

## Funcionalidades de Gestión

### Actualización Masiva de Precios
- **Endpoint**: \`POST /api/price-list/:id/apply-percentage\`
- **Función**: Aplica cambios porcentuales a todos los productos de una lista
- **Uso**: Ajustes por inflación, promociones, etc.

### Cambio de Lista de Precios en Contratos
- **Endpoint**: \`POST /api/persons/:personId/contracts/change-price-list\`
- **Función**: Cambia la lista de precios asignada a un contrato
- **Uso**: Renegociaciones, cambios de categoría de cliente

### Historial de Cambios
- **Endpoints**: \`GET /api/price-list/:id/history\` y \`GET /api/price-list/item/:itemId/history\`
- **Función**: Mantiene trazabilidad de todos los cambios de precios

## Configuración del Sistema

En \`src/common/config/business.config.ts\`:
\`\`\`typescript
PRICING: {
  DEFAULT_PRICE_LIST_ID: 1,
  STANDARD_PRICE_LIST_NAME: 'Lista General/Estándar',
}
\`\`\`

## Casos de Uso Comunes

1. **Cliente Corporativo**: Contrato con lista de precios con descuentos especiales
2. **Cliente Ocasional**: Compra única usando lista general/pública
3. **Cliente Suscriptor**: Plan fijo mensual con precio cerrado
4. **Actualización Estacional**: Aplicar 10% de aumento a lista general por inflación
5. **Renegociación**: Migrar contrato de lista estándar a lista corporativa`,
  })
  @ApiResponse({
    status: 200,
    description: 'Documentación del sistema de precios',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Documentación del Sistema de Precios Diferenciados',
        },
        version: { type: 'string', example: '1.0' },
        last_updated: { type: 'string', format: 'date' },
        endpoints: {
          type: 'object',
          properties: {
            contracts: { type: 'string', example: 'POST /api/orders' },
            one_off_purchases: {
              type: 'string',
              example: 'POST /api/one-off-purchases/one-off',
            },
            subscriptions: {
              type: 'string',
              example: 'POST /api/customer-subscriptions',
            },
            price_lists: { type: 'string', example: 'GET /api/price-list' },
            price_management: {
              type: 'string',
              example: 'POST /api/price-list/:id/apply-percentage',
            },
          },
        },
      },
    },
  })
  getPricingSystemDocs() {
    return {
      message: 'Documentación del Sistema de Precios Diferenciados',
      version: '1.0',
      last_updated: '2024-01-15',
      system_overview: {
        contracts: 'Usan listas de precios específicas del contrato',
        one_off_purchases: 'Usan Lista General/Estándar (ID: 1)',
        subscriptions: 'Usan precio fijo del plan de suscripción',
      },
      price_flow: {
        contracts:
          'client_contract.price_list_id → price_list_item.unit_price → product.price (fallback)',
        one_off:
          'Lista General (ID: 1) → price_list_item.unit_price → product.price (fallback)',
        subscriptions: 'subscription_plan.price (precio cerrado)',
      },
      key_endpoints: {
        contracts: 'POST /api/orders',
        one_off_purchases: 'POST /api/one-off-purchases/one-off',
        subscriptions: 'POST /api/customer-subscriptions',
        price_lists: 'GET /api/price-list',
        price_management: 'POST /api/price-list/:id/apply-percentage',
        contract_price_change:
          'POST /api/persons/:personId/contracts/change-price-list',
      },
      configuration: {
        default_price_list_id: 1,
        standard_price_list_name: 'Lista General/Estándar',
      },
    };
  }
}
