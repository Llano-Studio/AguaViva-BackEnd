import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, HttpCode, HttpStatus, ValidationPipe } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { subscription_plan as SubscriptionPlanPrisma } from '@prisma/client'; 
import { AddProductToPlanDto } from './dto/add-product-to-plan.dto';
import { UpdateProductInPlanDto } from './dto/update-product-in-plan.dto';
import { AdjustPlanProductQuantitiesDto, AdjustAllPlansPriceDto } from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Planes de suscripción (Abonos)')
@ApiBearerAuth()
@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(private readonly subscriptionPlansService: SubscriptionPlansService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo plan de suscripción (abono)' })
  @ApiResponse({ status: 201, description: 'Plan creado exitosamente.', type: CreateSubscriptionPlanDto }) 
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 409, description: 'Conflicto, el ID del plan ya existe.' })
  async create(@Body() createSubscriptionPlanDto: CreateSubscriptionPlanDto): Promise<SubscriptionPlanPrisma> {
    return this.subscriptionPlansService.create(createSubscriptionPlanDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los planes de suscripción' })
  @ApiResponse({ status: 200, description: 'Lista de planes obtenida.' }) // Idealmente un array de DTO de respuesta
  async findAll(): Promise<SubscriptionPlanPrisma[]> {
    return this.subscriptionPlansService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un plan de suscripción por ID' })
  @ApiResponse({ status: 200, description: 'Plan obtenido.' }) // Idealmente un DTO de respuesta
  @ApiResponse({ status: 404, description: 'Plan no encontrado.' })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<SubscriptionPlanPrisma> {
    return this.subscriptionPlansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un plan de suscripción por ID' })
  @ApiResponse({ status: 200, description: 'Plan actualizado exitosamente.'}) // Idealmente un DTO de respuesta
  @ApiResponse({ status: 404, description: 'Plan no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto al actualizar.' })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateSubscriptionPlanDto: UpdateSubscriptionPlanDto): Promise<SubscriptionPlanPrisma> {
    return this.subscriptionPlansService.update(id, updateSubscriptionPlanDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar un plan de suscripción por ID' })
  @ApiResponse({ status: 200, description: 'Plan eliminado exitosamente.', schema: { type: 'object', properties: { message: { type: 'string'} } } })
  @ApiResponse({ status: 404, description: 'Plan no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto, el plan tiene suscripciones de clientes asociadas.' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    return this.subscriptionPlansService.remove(id);
  }



  @Post(':planId/products')
  @ApiOperation({ summary: 'Añadir un producto a un plan de suscripción específico' })
  @ApiResponse({ status: 201, description: 'Producto añadido al plan exitosamente.' }) 
  @ApiResponse({ status: 404, description: 'Plan de suscripción o Producto no encontrado.' })
  @ApiResponse({ status: 409, description: 'El producto ya existe en este plan.' })
  async addProductToPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() addProductToPlanDto: AddProductToPlanDto,
  ): Promise<SubscriptionPlanPrisma> {
    return this.subscriptionPlansService.addProductToPlan(planId, addProductToPlanDto);
  }

  @Patch(':planId/products/:productId')
  @ApiOperation({ summary: 'Actualizar la cantidad de un producto en un plan de suscripción' })
  @ApiResponse({ status: 200, description: 'Producto en plan actualizado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Plan, producto o la asociación producto-plan no encontrada.' })
  async updateProductInPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() updateProductInPlanDto: UpdateProductInPlanDto,
  ): Promise<SubscriptionPlanPrisma> {
    return this.subscriptionPlansService.updateProductInPlan(planId, productId, updateProductInPlanDto);
  }

  @Delete(':planId/products/:productId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar un producto de un plan de suscripción' })
  @ApiResponse({ status: 200, description: 'Producto eliminado del plan exitosamente.' }) 
  @ApiResponse({ status: 404, description: 'Plan, producto o la asociación producto-plan no encontrada.' })
  async removeProductFromPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<SubscriptionPlanPrisma> {
    return this.subscriptionPlansService.removeProductFromPlan(planId, productId);
  }

  @Patch(':planId/products/adjust-quantities')
  @ApiOperation({ summary: 'Ajustar las cantidades de todos los productos en un plan por un porcentaje.' })
  @ApiResponse({ status: 200, description: 'Cantidades de productos en el plan ajustadas exitosamente.' }) 
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (ej. porcentaje incorrecto).' })
  @ApiResponse({ status: 404, description: 'Plan de suscripción no encontrado.' })
  async adjustProductQuantitiesInPlan(
    @Param('planId', ParseIntPipe) planId: number,
    @Body() adjustQuantitiesDto: AdjustPlanProductQuantitiesDto,
  ): Promise<SubscriptionPlanPrisma> {
    return this.subscriptionPlansService.adjustProductQuantitiesInPlan(planId, adjustQuantitiesDto);
  }

  @Patch('adjust-all-prices')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Ajustar masivamente los precios fijos de todos los planes de suscripción por porcentaje',
    description: 'Aplica un cambio porcentual a los precios base de todos los planes que tengan un precio fijo definido.'
  })
  @ApiResponse({ status: 200, description: 'Precios de los planes actualizados exitosamente.', schema: { type: 'object', properties: { updated_count: {type: 'number'}, message: {type: 'string'} }} })
  @ApiResponse({ status: 400, description: 'Porcentaje de cambio inválido (ej. resultaría en precio negativo).' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async adjustAllSubscriptionPlanPrices(@Body(ValidationPipe) adjustPricesDto: AdjustAllPlansPriceDto) {
    return this.subscriptionPlansService.adjustAllPlanPrices(adjustPricesDto);
  }
} 