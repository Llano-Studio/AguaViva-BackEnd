import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode, HttpStatus, ValidationPipe, Query } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { subscription_plan as SubscriptionPlanPrisma } from '@prisma/client'; 
import { AddProductToPlanDto } from './dto/add-product-to-plan.dto';
import { UpdateProductInPlanDto } from './dto/update-product-in-plan.dto';
import { AdjustPlanProductQuantitiesDto, AdjustAllPlansPriceDto } from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { SubscriptionPlanResponseDto, PaginatedSubscriptionPlanResponseDto, FilterSubscriptionPlansDto } from './dto';

@ApiTags('Planes de Suscripción')
@ApiBearerAuth()
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly subscriptionPlansService: SubscriptionPlansService) {}

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo plan de suscripción' })
  @ApiBody({ type: CreateSubscriptionPlanDto })
  @ApiResponse({ status: 201, description: 'Plan de suscripción creado exitosamente.', type: SubscriptionPlanResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  create(@Body(ValidationPipe) createSubscriptionPlanDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.create(createSubscriptionPlanDto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener todos los planes de suscripción' })
  @ApiQuery({ name: 'search', required: false, type: String, description: "Búsqueda general por nombre o descripción del plan", example: "premium" })
  @ApiQuery({ name: 'name', required: false, type: String, description: "Filtrar por nombre específico del plan", example: "Plan Premium" })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: "Campos para ordenar. Ej: name,-price", example: "name,-price" })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiResponse({ status: 200, description: 'Planes de suscripción obtenidos exitosamente.', type: PaginatedSubscriptionPlanResponseDto })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findAll(
    @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) 
    filters: FilterSubscriptionPlansDto,
  ): Promise<PaginatedSubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.findAll(filters);
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener un plan de suscripción por su ID' })
  @ApiParam({ name: 'id', description: 'ID del plan de suscripción', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Plan de suscripción encontrado.', type: SubscriptionPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Plan de suscripción no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar un plan de suscripción por su ID' })
  @ApiParam({ name: 'id', description: 'ID del plan de suscripción a actualizar', type: Number, example: 1 })
  @ApiBody({ type: UpdateSubscriptionPlanDto })
  @ApiResponse({ status: 200, description: 'Plan de suscripción actualizado exitosamente.', type: SubscriptionPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Plan de suscripción no encontrado.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateSubscriptionPlanDto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.update(id, updateSubscriptionPlanDto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar un plan de suscripción por su ID' })
  @ApiParam({ name: 'id', description: 'ID del plan de suscripción a eliminar', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Plan de suscripción eliminado exitosamente.', schema: { properties: { message: { type: 'string' }, deleted: { type: 'boolean' } } } })
  @ApiResponse({ status: 404, description: 'Plan de suscripción no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El plan está en uso por suscripciones activas.' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string, deleted: boolean }>{
    return this.subscriptionPlansService.remove(id);
  }

  @Post(':planId/products')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Añadir un producto a un plan de suscripción' })
  @ApiParam({ name: 'planId', description: 'ID del plan de suscripción', type: Number, example: 1 })
  @ApiBody({ type: AddProductToPlanDto })
  @ApiResponse({ status: 201, description: 'Producto añadido al plan exitosamente.', type: SubscriptionPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Plan de suscripción o producto no encontrado.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o el producto ya existe en el plan.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  addProductToPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Body(ValidationPipe) addProductToPlanDto: AddProductToPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.addProductToPlan(planId, addProductToPlanDto);
  }

  @Patch(':planId/products/:productId')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar la cantidad de un producto en un plan de suscripción' })
  @ApiParam({ name: 'planId', description: 'ID del plan de suscripción', type: Number, example: 1 })
  @ApiParam({ name: 'productId', description: 'ID del producto en el plan', type: Number, example: 101 })
  @ApiBody({ type: UpdateProductInPlanDto })
  @ApiResponse({ status: 200, description: 'Producto en el plan actualizado exitosamente.', type: SubscriptionPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Plan de suscripción, producto o la relación producto-plan no encontrada.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (ej. cantidad no positiva).' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  updateProductInPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body(ValidationPipe) updateProductInPlanDto: UpdateProductInPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.updateProductInPlan(planId, productId, updateProductInPlanDto);
  }

  @Delete(':planId/products/:productId')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar un producto de un plan de suscripción' })
  @ApiParam({ name: 'planId', description: 'ID del plan de suscripción', type: Number, example: 1 })
  @ApiParam({ name: 'productId', description: 'ID del producto a eliminar del plan', type: Number, example: 101 })
  @ApiResponse({ status: 200, description: 'Producto eliminado del plan exitosamente.', type: SubscriptionPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Plan de suscripción, producto o la relación producto-plan no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  removeProductFromPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.removeProductFromPlan(planId, productId);
  }

  @Post('adjust-prices')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Ajustar el precio de todos los planes de suscripción por un porcentaje o monto fijo',
    description: 'Permite aplicar un aumento o disminución a todos los planes. Se debe especificar `percentage` o `fixedAmount`, no ambos.'
  })
  @ApiBody({ type: AdjustAllPlansPriceDto })
  @ApiResponse({ status: 200, description: 'Precios de los planes ajustados exitosamente.', schema: { properties: { message: { type: 'string' }, updated_count: {type: 'number'} } } })
  @ApiResponse({ status: 400, description: 'Datos inválidos (ej. porcentaje y monto fijo especificados, o ninguno).' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  adjustAllPlansPrice(@Body(ValidationPipe) adjustAllPlansPriceDto: AdjustAllPlansPriceDto): Promise<{ message: string, updated_count: number }> {
    return this.subscriptionPlansService.adjustAllPlansPrice(adjustAllPlansPriceDto);
  }

  @Post(':planId/adjust-product-quantities')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Ajustar las cantidades de múltiples productos en un plan de suscripción específico',
    description: 'Permite actualizar, agregar o eliminar varios productos y sus cantidades en un plan de una sola vez.'
  })
  @ApiParam({ name: 'planId', description: 'ID del plan de suscripción a modificar', type: Number, example: 1 })
  @ApiBody({ type: AdjustPlanProductQuantitiesDto })
  @ApiResponse({ status: 200, description: 'Cantidades de productos en el plan ajustadas exitosamente.', type: SubscriptionPlanResponseDto })
  @ApiResponse({ status: 404, description: 'Plan de suscripción o alguno de los productos no encontrado.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos (ej. cantidades no positivas, producto duplicado en la lista).' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  adjustPlanProductQuantities(
    @Param('planId', ParseIntPipe) planId: number,
    @Body(ValidationPipe) adjustPlanProductQuantitiesDto: AdjustPlanProductQuantitiesDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.subscriptionPlansService.adjustProductQuantitiesInPlan(planId, adjustPlanProductQuantitiesDto);
  }
} 