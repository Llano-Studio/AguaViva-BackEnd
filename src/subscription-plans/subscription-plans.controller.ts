import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AddProductToPlanDto } from './dto/add-product-to-plan.dto';
import { UpdateProductInPlanDto } from './dto/update-product-in-plan.dto';
import { AdjustPlanProductQuantitiesDto, AdjustAllPlansPriceDto } from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import {
  SubscriptionPlanResponseDto,
  PaginatedSubscriptionPlanResponseDto,
  FilterSubscriptionPlansDto,
} from './dto';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@ApiTags('📋 Planes de Suscripción')
@ApiBearerAuth()
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  @Post()
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Crear nuevo plan de suscripción',
    description: `Crea un nuevo plan de suscripción con configuraciones personalizables para diferentes tipos de clientes.

## 📋 CONFIGURACIÓN DE PLANES

**Información Básica:**
- Nombre descriptivo del plan
- Descripción detallada del servicio
- Precio fijo mensual del plan
- Estado de disponibilidad

## ⏰ CONFIGURACIÓN DE CICLOS

**Parámetros de Entrega:**
- **Duración del Ciclo**: Días entre facturaciones (ej: 30 días = mensual)
- **Entregas por Ciclo**: Frecuencia de entregas (ej: 2 = quincenal)
- **Flexibilidad**: Adaptable a diferentes necesidades

## 📦 GESTIÓN DE PRODUCTOS

**Después de Crear el Plan:**
- Agregar productos específicos al plan
- Definir cantidades por producto
- Configurar productos retornables
- Establecer precios por ítem

## 🎯 TIPOS DE PLANES COMUNES

- **Plan Básico**: 30 días, 1 entrega, productos esenciales
- **Plan Premium**: 15 días, 2 entregas, productos premium
- **Plan Familiar**: 30 días, 1 entrega, cantidades grandes
- **Plan Corporativo**: Personalizado según necesidades`,
  })
  @ApiBody({
    type: CreateSubscriptionPlanDto,
    examples: {
      planBasico: {
        summary: 'Plan Básico',
        description: 'Ejemplo de un plan básico mensual',
        value: {
          name: 'Plan Básico Mensual',
          description:
            'Plan básico con entrega mensual de productos esenciales',
          price: 15000.0,
          default_cycle_days: 30,
          default_deliveries_per_cycle: 1,
          is_active: true,
        },
      },
      planPremium: {
        summary: 'Plan Premium',
        description: 'Ejemplo de un plan premium con entregas quincenales',
        value: {
          name: 'Plan Premium Quincenal',
          description: 'Plan premium con entregas cada 15 días',
          price: 25000.0,
          default_cycle_days: 15,
          default_deliveries_per_cycle: 2,
          is_active: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Plan de suscripción creado exitosamente.',
    type: SubscriptionPlanResponseDto,
    example: {
      subscription_plan_id: 1,
      name: 'Plan Básico Mensual',
      description: 'Plan básico con entrega mensual de productos esenciales',
      price: 15000.0,
      default_cycle_days: 30,
      default_deliveries_per_cycle: 1,
      is_active: true,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
      products: [],
    },
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - Ya existe un plan con el mismo nombre.',
  })
  create(
    @Body(ValidationPipe) createSubscriptionPlanDto: CreateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.create(createSubscriptionPlanDto);
  }

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener todos los planes de suscripción',
    description: `Obtiene una lista paginada de todos los planes de suscripción con filtros avanzados y ordenamiento personalizable.

## 🔍 FILTROS DISPONIBLES

**Búsqueda Inteligente:**
- **search**: Búsqueda general en nombre y descripción
- **name**: Filtro exacto por nombre del plan
- **is_active**: Filtrar por estado (activo/inactivo)

## 📊 ORDENAMIENTO AVANZADO

**Campos Disponibles:**
- \`name\`: Nombre del plan
- \`price\`: Precio del plan
- \`default_cycle_days\`: Duración del ciclo
- \`default_deliveries_per_cycle\`: Entregas por ciclo
- \`is_active\`: Estado de activación
- \`created_at\`, \`updated_at\`: Fechas

**Sintaxis:** \`campo1,-campo2,campo3\` (- = descendente)

## 📋 INFORMACIÓN INCLUIDA

**Datos del Plan:**
- Configuración de precios y ciclos
- Estado de disponibilidad
- Productos asociados con cantidades
- Fechas de creación y actualización

## 🎯 CASOS DE USO

- **Gestión Comercial**: Visualizar todos los planes disponibles
- **Configuración de Precios**: Comparar precios entre planes
- **Análisis de Productos**: Revisar configuración de productos por plan
- **Administración**: Control de planes activos/inactivos
- **Reportes**: Información para análisis comercial`,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Búsqueda general por nombre o descripción del plan',
    example: 'premium',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filtrar por nombre específico del plan',
    example: 'Plan Premium',
  })
  @ApiQuery({
    name: 'is_active',
    required: false,
    type: Boolean,
    description:
      'Filtrar por estado de activación. true = solo activos, false = solo inactivos',
    example: true,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Campos para ordenar. Ej: name,-price,default_cycle_days',
    example: 'name,-price',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página (mínimo 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `Resultados por página (mínimo 1, máximo ${BUSINESS_CONFIG.PAGINATION.MAX_LIMIT})`,
    example: BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
  })
  @ApiResponse({
    status: 200,
    description: 'Planes de suscripción obtenidos exitosamente.',
    type: PaginatedSubscriptionPlanResponseDto,
    example: {
      data: [
        {
          subscription_plan_id: 1,
          name: 'Plan Básico',
          description: 'Plan básico mensual',
          price: 15000.0,
          default_cycle_days: 30,
          default_deliveries_per_cycle: 1,
          is_active: true,
          created_at: '2024-01-15T10:30:00Z',
          updated_at: '2024-01-15T10:30:00Z',
          products: [],
        },
      ],
      total: 1,
      page: 1,
      limit: BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
      totalPages: 1,
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filters: FilterSubscriptionPlansDto,
  ): Promise<PaginatedSubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.findAll(filters);
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener un plan de suscripción por su ID',
    description: `Obtiene los detalles completos de un plan de suscripción específico, incluyendo todos los productos asociados y la configuración de ciclos.`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plan de suscripción',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Plan de suscripción encontrado.',
    type: SubscriptionPlanResponseDto,
    example: {
      subscription_plan_id: 1,
      name: 'Plan Básico Mensual',
      description: 'Plan básico con entrega mensual de productos esenciales',
      price: 15000.0,
      default_cycle_days: 30,
      default_deliveries_per_cycle: 1,
      is_active: true,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T10:30:00Z',
      products: [
        {
          product_id: 101,
          product_description: 'Agua Purificada 20L',
          product_code: 'AGP20L',
          quantity: 4,
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Plan de suscripción no encontrado.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar un plan de suscripción por su ID',
    description: `Actualiza los campos de un plan de suscripción existente. Todos los campos son opcionales.
    
**Campos actualizables:**
- \`name\`: Nombre del plan
- \`description\`: Descripción del plan  
- \`price\`: Precio del plan
- \`default_cycle_days\`: Duración por defecto del ciclo en días
- \`default_deliveries_per_cycle\`: Número de entregas por defecto por ciclo
- \`is_active\`: Si el plan está disponible para nuevas suscripciones

**Nota:** Los cambios no afectan suscripciones existentes, solo se aplican a nuevas suscripciones.
**Disponible para:** SUPERADMIN y Jefe Administrativo.`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plan de suscripción a actualizar',
    type: Number,
    example: 1,
  })
  @ApiBody({
    type: UpdateSubscriptionPlanDto,
    examples: {
      actualizarPrecio: {
        summary: 'Actualizar solo precio',
        description: 'Ejemplo de actualización solo del precio',
        value: {
          price: 18000.0,
        },
      },
      actualizarCiclo: {
        summary: 'Actualizar configuración de ciclo',
        description: 'Ejemplo de actualización de configuración de ciclos',
        value: {
          default_cycle_days: 15,
          default_deliveries_per_cycle: 2,
        },
      },
      desactivarPlan: {
        summary: 'Desactivar plan',
        description: 'Ejemplo de desactivación de plan',
        value: {
          is_active: false,
        },
      },
      actualizacionCompleta: {
        summary: 'Actualización completa',
        description: 'Ejemplo de actualización de múltiples campos',
        value: {
          name: 'Plan Premium Actualizado',
          description: 'Plan premium con nuevas características',
          price: 22000.0,
          default_cycle_days: 30,
          default_deliveries_per_cycle: 1,
          is_active: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Plan de suscripción actualizado exitosamente.',
    type: SubscriptionPlanResponseDto,
    example: {
      subscription_plan_id: 1,
      name: 'Plan Premium Actualizado',
      description: 'Plan premium con nuevas características',
      price: 22000.0,
      default_cycle_days: 30,
      default_deliveries_per_cycle: 1,
      is_active: true,
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T14:45:00Z',
      products: [],
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Plan de suscripción no encontrado.',
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - Ya existe otro plan con el mismo nombre.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.update(id, updateSubscriptionPlanDto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Eliminar un plan de suscripción por su ID',
    description: `Elimina un plan de suscripción y todos sus productos asociados.
    
**Restricciones de seguridad:**
- No se puede eliminar un plan que tiene suscripciones de clientes activas o pausadas
- Primero debe cancelar todas las suscripciones asociadas al plan

**Efecto:** Elimina el plan y todas las relaciones producto-plan automáticamente.
**Disponible para:** SUPERADMIN y Jefe Administrativo.`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID del plan de suscripción a eliminar',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Plan de suscripción eliminado exitosamente.',
    schema: {
      properties: {
        message: {
          type: 'string',
          example:
            'Plan de Suscripción con ID 1 y sus productos asociados eliminados correctamente.',
        },
        deleted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Plan de suscripción no encontrado.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - El plan está en uso por suscripciones activas o pausadas. Debe cancelar las suscripciones primero.',
    example: {
      statusCode: 409,
      message:
        'El plan de suscripción con ID 1 no puede ser eliminado porque tiene 3 suscripciones de clientes asociadas activas o pausadas. Considere cancelarlas primero.',
      error: 'Conflict',
    },
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    return this.subscriptionPlansService.remove(id);
  }

  @Post(':planId/products')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({ summary: 'Añadir un producto a un plan de suscripción' })
  @ApiParam({
    name: 'planId',
    description: 'ID del plan de suscripción',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: AddProductToPlanDto })
  @ApiResponse({
    status: 201,
    description: 'Producto añadido al plan exitosamente.',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Plan de suscripción o producto no encontrado.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o el producto ya existe en el plan.', 
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  addProductToPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Body(ValidationPipe) addProductToPlanDto: AddProductToPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.addProductToPlan(
      planId,
      addProductToPlanDto,
    );
  }

  @Patch(':planId/products/:productId')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar la cantidad de un producto en un plan de suscripción',
  })
  @ApiParam({
    name: 'planId',
    description: 'ID del plan de suscripción',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'productId',
    description: 'ID del producto en el plan',
    type: Number,
    example: 101,
  })
  @ApiBody({ type: UpdateProductInPlanDto })
  @ApiResponse({
    status: 200,
    description: 'Producto en el plan actualizado exitosamente.',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description:
      'Plan de suscripción, producto o la relación producto-plan no encontrada.',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos (ej. cantidad no positiva).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  updateProductInPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body(ValidationPipe) updateProductInPlanDto: UpdateProductInPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.updateProductInPlan(
      planId,
      productId,
      updateProductInPlanDto,
    );
  }

  @Delete(':planId/products/:productId')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({ summary: 'Eliminar un producto de un plan de suscripción' })
  @ApiParam({
    name: 'planId',
    description: 'ID del plan de suscripción',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'productId',
    description: 'ID del producto a eliminar del plan',
    type: Number,
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Producto eliminado del plan exitosamente.',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description:
      'Plan de suscripción, producto o la relación producto-plan no encontrada.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  removeProductFromPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.removeProductFromPlan(
      planId,
      productId,
    );
  }

  @Post('adjust-prices')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary:
      'Ajustar el precio de todos los planes de suscripción por un porcentaje o monto fijo',
    description:
      'Permite aplicar un aumento o disminución a todos los planes. Se debe especificar `percentage` o `fixedAmount`, no ambos.',
  })
  @ApiBody({ type: AdjustAllPlansPriceDto })
  @ApiResponse({
    status: 200,
    description: 'Precios de los planes ajustados exitosamente.',
    schema: {
      properties: {
        message: { type: 'string' },
        updated_count: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos (ej. porcentaje y monto fijo especificados, o ninguno).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  adjustAllPlansPrice(
    @Body(ValidationPipe) adjustAllPlansPriceDto: AdjustAllPlansPriceDto,
  ): Promise<{ message: string; updated_count: number }> {
    return this.subscriptionPlansService.adjustAllPlansPrice(
      adjustAllPlansPriceDto,
    );
  }

  @Post(':planId/adjust-product-quantities')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary:
      'Ajustar las cantidades de múltiples productos en un plan de suscripción específico',
    description:
      'Permite actualizar, agregar o eliminar varios productos y sus cantidades en un plan de una sola vez.',
  })
  @ApiParam({
    name: 'planId',
    description: 'ID del plan de suscripción a modificar',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: AdjustPlanProductQuantitiesDto })
  @ApiResponse({
    status: 200,
    description: 'Cantidades de productos en el plan ajustadas exitosamente.',
    type: SubscriptionPlanResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Plan de suscripción o alguno de los productos no encontrado.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos (ej. cantidades no positivas, producto duplicado en la lista).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  adjustPlanProductQuantities(
    @Param('planId', ParseIntPipe) planId: number,
    @Body(ValidationPipe)
    adjustPlanProductQuantitiesDto: AdjustPlanProductQuantitiesDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.adjustProductQuantitiesInPlan(
      planId,
      adjustPlanProductQuantitiesDto,
    );
  }

  @Get('diagnostics/without-price')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Diagnóstico: Planes sin precio definido',
    description:
      'Obtiene una lista de planes que no tienen precio definido, identificando casos críticos con suscripciones activas',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de planes sin precio',
    schema: {
      properties: {
        plans_without_price: {
          type: 'array',
          items: {
            properties: {
              subscription_plan_id: { type: 'number' },
              name: { type: 'string' },
              price: { type: 'number', nullable: true },
              is_active: { type: 'boolean' },
              active_subscriptions_count: { type: 'number' },
            },
          },
        },
        total_count: { type: 'number' },
        critical_count: { type: 'number' },
      },
    },
  })
  async getPlansWithoutPrice() {
    return this.subscriptionPlansService.getPlansWithoutPrice();
  }

  @Patch(':id/assign-price')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Asignar precio a un plan',
    description: 'Asigna un precio específico a un plan de suscripción',
  })
  @ApiParam({ name: 'id', description: 'ID del plan de suscripción' })
  @ApiBody({
    schema: {
      properties: {
        price: {
          type: 'number',
          example: 18300.0,
          description: 'Precio a asignar al plan',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Precio asignado exitosamente',
    type: SubscriptionPlanResponseDto,
  })
  async assignPriceToplan(
    @Param('id', ParseIntPipe) id: number,
    @Body('price') price: number,
  ) {
    return this.subscriptionPlansService.assignPriceToplan(id, price);
  }
}
