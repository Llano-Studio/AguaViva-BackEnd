import { Controller, Get, Param, ParseIntPipe, Post, Body, HttpCode, HttpStatus, Query, ValidationPipe } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { InventoryResponseDto } from './dto/inventory-response.dto';
import { stock_movement as StockMovementPrisma } from '@prisma/client';
import { StockMovementResponseDto } from './dto/stock-movement-response.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { FilterInventoryDto, PaginatedInventoryResponseDto, InventoryDetailDto } from './dto/filter-inventory.dto';

@ApiTags('Inventario')
@ApiBearerAuth()
@Auth(Role.ADMIN, Role.USER)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('product/:productId/stock')
  @ApiOperation({ 
    summary: 'Obtener el stock total de un producto', 
    description: 'Devuelve la cantidad total disponible en stock de un producto en todos los almacenes. Opcionalmente, si se provee warehouseId, devuelve el stock en ese almacén específico.'
  })
  @ApiParam({ 
    name: 'productId', 
    description: 'ID del producto a consultar', 
    type: Number,
    required: true
  })
  @ApiQuery({ 
    name: 'warehouseId', 
    description: 'ID del almacén para consultar stock específico (opcional)',
    type: Number,
    required: false
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cantidad de stock obtenida exitosamente.',
    schema: { type: 'number', example: 100 }
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  async getProductStock(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('warehouseId', new ParseIntPipe({ optional: true })) warehouseId?: number,
  ): Promise<number> {
    return this.inventoryService.getProductStock(productId, warehouseId);
  }

  @Post('create-inventory')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Crear inventario inicial', 
    description: 'Crea un registro de inventario inicial para un producto en un almacén específico. Este endpoint debe usarse únicamente para establecer stock inicial cuando no existe registro previo.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Inventario inicial creado exitosamente.', 
    type: InventoryResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o ya existe inventario para este producto/almacén.' })
  @ApiResponse({ status: 404, description: 'Producto o almacén no encontrado.' })
  async createInitialInventory(
    @Body(ValidationPipe) createInventoryDto: CreateInventoryDto,
  ): Promise<InventoryResponseDto> {
    return this.inventoryService.createInitialInventory(createInventoryDto);
  }

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Registrar un nuevo movimiento de stock', 
    description: 'Crea un nuevo movimiento de inventario afectando el stock disponible. Soporta diferentes tipos de movimientos.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Movimiento de stock registrado exitosamente.', 
    type: StockMovementResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'Recurso no encontrado (Producto, Tipo Movimiento, Almacén).' })
  async createStockMovement(
    @Body(ValidationPipe) createStockMovementDto: CreateStockMovementDto,
  ): Promise<StockMovementPrisma> {
    return this.inventoryService.createStockMovement(createStockMovementDto);
  }

  @Get('stock/full')
  @ApiOperation({ 
    summary: 'Obtener el stock completo detallado y paginado',
    description: 'Devuelve una lista de todo el inventario, mostrando detalles del producto y almacén, con paginación, filtros y ordenamiento.'
  })
  @ApiQuery({ name: 'warehouse_id', required: false, type: Number, description: 'ID del almacén para filtrar el inventario' })
  @ApiQuery({ name: 'product_id', required: false, type: Number, description: 'ID del producto para filtrar el inventario' })
  @ApiQuery({ name: 'product_description', required: false, type: String, description: 'Texto para buscar en la descripción del producto' })
  @ApiQuery({ name: 'category_id', required: false, type: Number, description: 'ID de la categoría del producto para filtrar' })
  @ApiQuery({ name: 'min_quantity', required: false, type: Number, description: 'Cantidad mínima de stock para filtrar' })
  @ApiQuery({ name: 'max_quantity', required: false, type: Number, description: 'Cantidad máxima de stock para filtrar' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: "Campos para ordenar. Ej: product.description,-quantity", example: 'product.description,-quantity' })
  @ApiResponse({ 
    status: 200, 
    description: 'Stock detallado obtenido exitosamente.',
    type: PaginatedInventoryResponseDto
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  async getFullStockWithDetails(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, forbidNonWhitelisted: true })) 
    filters: FilterInventoryDto
  ): Promise<PaginatedInventoryResponseDto> {
    return this.inventoryService.getFullStockWithDetails(filters);
  }

  @Get('stock/product/:productId/warehouse/:warehouseId')
  @ApiOperation({ 
    summary: 'Obtener el stock de un producto en un almacén específico', 
    description: 'Devuelve la cantidad disponible y detalles del stock de un producto en un almacén específico.'
  })
  @ApiParam({ name: 'productId', description: 'ID del producto', type: Number, required: true })
  @ApiParam({ name: 'warehouseId', description: 'ID del almacén', type: Number, required: true })
  @ApiResponse({ 
    status: 200, 
    description: 'Stock específico obtenido exitosamente.',
    schema: {
      properties: {
        productId: { type: 'number', example: 1 },
        warehouseId: { type: 'number', example: 2 },
        quantity: { type: 'number', example: 50 },
        productDescription: { type: 'string', example: 'Agua Bidón 20L' },
        warehouseName: { type: 'string', example: 'Almacén Principal' }
      }
    } 
  })
  @ApiResponse({ status: 404, description: 'Inventario no encontrado para el producto y almacén especificados.' })
  async getStockInWarehouse(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('warehouseId', ParseIntPipe) warehouseId: number,
  ): Promise<{ productId: number, warehouseId: number, quantity: number, productDescription: string, warehouseName: string }> {
    return this.inventoryService.getStockInWarehouse(productId, warehouseId);
  }
} 