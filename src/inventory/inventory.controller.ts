import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { InventoryResponseDto } from './dto/inventory-response.dto';
import { stock_movement as StockMovementPrisma } from '@prisma/client';
import { StockMovementResponseDto } from './dto/stock-movement-response.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import {
  FilterInventoryDto,
  PaginatedInventoryResponseDto,
} from './dto/filter-inventory.dto';

@ApiTags('Inventario')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('product/:productId/stock')
  @ApiOperation({
    summary: 'Consultar stock total de un producto específico',
    description: `Obtiene la cantidad total disponible de un producto en el sistema de inventario.

## 📦 CONSULTA DE STOCK

**Funcionalidad Principal:**
- Consulta stock total en todos los almacenes
- Opción de consulta por almacén específico
- Cálculo automático de disponibilidad
- Información en tiempo real

## 🏪 ALCANCE DE CONSULTA

**Stock Total (sin warehouseId):**
- Suma de todas las cantidades en todos los almacenes
- Vista consolidada del producto
- Útil para disponibilidad general

**Stock Específico (con warehouseId):**
- Cantidad en almacén particular
- Útil para planificación de entregas
- Control de stock por ubicación

## 🎯 CASOS DE USO

- **Verificación de Disponibilidad**: Antes de crear órdenes
- **Planificación de Compras**: Identificar productos con stock bajo
- **Distribución Logística**: Verificar stock por almacén
- **Reportes de Inventario**: Análisis de disponibilidad`,
  })
  @ApiParam({
    name: 'productId',
    description: 'ID del producto a consultar',
    type: Number,
    required: true,
  })
  @ApiQuery({
    name: 'warehouseId',
    description: 'ID del almacén para consultar stock específico (opcional)',
    type: Number,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Cantidad de stock obtenida exitosamente.',
    schema: { type: 'number', example: 100 },
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  async getProductStock(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('warehouseId', new ParseIntPipe({ optional: true }))
    warehouseId?: number,
  ): Promise<number> {
    return this.inventoryService.getProductStock(productId, warehouseId);
  }

  @Post('create-inventory')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear inventario inicial',
    description:
      'Crea un registro de inventario inicial para un producto en un almacén específico. Este endpoint debe usarse únicamente para establecer stock inicial cuando no existe registro previo.',
  })
  @ApiResponse({
    status: 201,
    description: 'Inventario inicial creado exitosamente.',
    type: InventoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos o ya existe inventario para este producto/almacén.',
  })
  @ApiResponse({
    status: 404,
    description: 'Producto o almacén no encontrado.',
  })
  async createInitialInventory(
    @Body(ValidationPipe) createInventoryDto: CreateInventoryDto,
  ): Promise<InventoryResponseDto> {
    return this.inventoryService.createInitialInventory(createInventoryDto);
  }

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar movimiento de stock en inventario',
    description: `Registra un movimiento de inventario que afecta el stock disponible de productos en almacenes.

## 📊 GESTIÓN DE MOVIMIENTOS

**Tipos de Movimiento:**
- **ENTRADA**: Aumenta stock (compras, devoluciones)
- **SALIDA**: Reduce stock (ventas, entregas)
- **TRANSFERENCIA**: Movimiento entre almacenes
- **AJUSTE**: Correcciones de inventario
- **MERMA**: Pérdidas o productos dañados

## 🔄 PROCESO AUTOMÁTICO

**Validaciones:**
- Verificación de stock suficiente para salidas
- Validación de productos y almacenes existentes
- Control de cantidades negativas
- Registro de trazabilidad completa

## 📝 INFORMACIÓN REGISTRADA

- Fecha y hora del movimiento
- Usuario responsable del movimiento
- Motivo y observaciones
- Impacto en stock actual
- Referencias a documentos relacionados

## 🎯 CASOS DE USO

- **Recepción de Mercadería**: Registrar llegada de productos
- **Entregas a Clientes**: Registrar salidas por ventas
- **Ajustes de Inventario**: Correcciones por conteos físicos
- **Transferencias**: Movimientos entre sucursales`,
  })
  @ApiResponse({
    status: 201,
    description: 'Movimiento de stock registrado exitosamente.',
    type: StockMovementResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({
    status: 404,
    description: 'Recurso no encontrado (Producto, Tipo Movimiento, Almacén).',
  })
  async createStockMovement(
    @Body(ValidationPipe) createStockMovementDto: CreateStockMovementDto,
  ): Promise<StockMovementPrisma> {
    return this.inventoryService.createStockMovement(createStockMovementDto);
  }

  @Get('stock/full')
  @ApiOperation({
    summary: 'Obtener el stock completo detallado y paginado',
    description: `Devuelve una lista completa del inventario con información detallada de productos y almacenes.

## 📊 CONSULTA AVANZADA DE INVENTARIO

**Filtros Disponibles:**
- **Por Almacén**: warehouse_id, warehouse_ids (múltiples)
- **Por Producto**: product_id, product_ids (múltiples), product_description (búsqueda inteligente)
- **Por Categoría**: category_id, category_ids (múltiples)
- **Por Cantidad**: min_quantity, max_quantity (rangos de stock)

## 🔍 BÚSQUEDA INTELIGENTE

**Búsqueda por Descripción:**
- Búsqueda parcial insensible a mayúsculas
- Coincidencias en cualquier parte del nombre
- Útil para encontrar productos específicos

**Filtros Múltiples:**
- Soporte para arrays de IDs
- Formato: [1,2,3] o "1,2,3"
- Combinación de múltiples criterios

## 📋 INFORMACIÓN INCLUIDA

**Datos del Producto:**
- ID y descripción completa
- Categoría del producto
- Cantidad actual en stock

**Datos del Almacén:**
- ID y nombre del almacén
- Localidad de ubicación
- Información geográfica

## 🎯 CASOS DE USO

- **Control de Inventario**: Vista general de todo el stock
- **Planificación Logística**: Stock por almacén y ubicación
- **Análisis de Productos**: Identificar productos con stock bajo/alto
- **Reportes Gerenciales**: Información consolidada para toma de decisiones
- **Auditorías**: Verificación de stock por categorías o almacenes`,
  })
  @ApiQuery({
    name: 'warehouse_id',
    required: false,
    type: Number,
    description: 'ID del almacén para filtrar el inventario',
  })
  @ApiQuery({
    name: 'product_id',
    required: false,
    type: Number,
    description: 'ID del producto para filtrar el inventario',
  })
  @ApiQuery({
    name: 'product_description',
    required: false,
    type: String,
    description: 'Texto para buscar en la descripción del producto',
  })
  @ApiQuery({
    name: 'category_id',
    required: false,
    type: Number,
    description: 'ID de la categoría del producto para filtrar',
  })
  @ApiQuery({
    name: 'min_quantity',
    required: false,
    type: Number,
    description: 'Cantidad mínima de stock para filtrar',
  })
  @ApiQuery({
    name: 'max_quantity',
    required: false,
    type: Number,
    description: 'Cantidad máxima de stock para filtrar',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Resultados por página',
    example: 10,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Campos para ordenar. Ej: product.description,-quantity',
    example: 'product.description,-quantity',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock detallado obtenido exitosamente.',
    type: PaginatedInventoryResponseDto,
  })
  @ApiResponse({ status: 500, description: 'Error interno del servidor.' })
  async getFullStockWithDetails(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filters: FilterInventoryDto,
  ): Promise<PaginatedInventoryResponseDto> {
    return this.inventoryService.getFullStockWithDetails(filters);
  }

  @Get('stock/product/:productId/warehouse/:warehouseId')
  @ApiOperation({
    summary: 'Obtener el stock de un producto en un almacén específico',
    description:
      'Devuelve la cantidad disponible y detalles del stock de un producto en un almacén específico.',
  })
  @ApiParam({
    name: 'productId',
    description: 'ID del producto',
    type: Number,
    required: true,
  })
  @ApiParam({
    name: 'warehouseId',
    description: 'ID del almacén',
    type: Number,
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Stock específico obtenido exitosamente.',
    schema: {
      properties: {
        productId: { type: 'number', example: 1 },
        warehouseId: { type: 'number', example: 2 },
        quantity: { type: 'number', example: 50 },
        productDescription: { type: 'string', example: 'Agua Bidón 20L' },
        warehouseName: { type: 'string', example: 'Almacén Principal' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description:
      'Inventario no encontrado para el producto y almacén especificados.',
  })
  async getStockInWarehouse(
    @Param('productId', ParseIntPipe) productId: number,
    @Param('warehouseId', ParseIntPipe) warehouseId: number,
  ): Promise<{
    productId: number;
    warehouseId: number;
    quantity: number;
    productDescription: string;
    warehouseName: string;
  }> {
    return this.inventoryService.getStockInWarehouse(productId, warehouseId);
  }

  /**
   * Configurar stock inicial para un producto nuevo
   */
  @Post('setup-initial-stock')
  @ApiOperation({
    summary: 'Configurar stock inicial para un producto en múltiples almacenes',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'number', example: 1 },
        stockByWarehouse: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              warehouseId: { type: 'number', example: 1 },
              quantity: { type: 'number', example: 100 },
              remarks: {
                type: 'string',
                example: 'Stock inicial - Producto nuevo',
              },
            },
            required: ['warehouseId', 'quantity'],
          },
        },
      },
      required: ['productId', 'stockByWarehouse'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Stock inicial configurado exitosamente',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        inventoriesCreated: { type: 'number' },
        movementsCreated: { type: 'number' },
        totalQuantity: { type: 'number' },
      },
    },
  })
  async setupInitialStock(
    @Body()
    body: {
      productId: number;
      stockByWarehouse: Array<{
        warehouseId: number;
        quantity: number;
        remarks?: string;
      }>;
    },
  ) {
    const results: any[] = [];
    let totalQuantity = 0;

    for (const stock of body.stockByWarehouse) {
      const inventoryData: CreateInventoryDto = {
        warehouse_id: stock.warehouseId,
        product_id: body.productId,
        quantity: stock.quantity,
        remarks: stock.remarks || `Stock inicial - Producto ${body.productId}`,
      };

      const result =
        await this.inventoryService.createInitialInventory(inventoryData);
      results.push(result);
      totalQuantity += stock.quantity;
    }

    return {
      message: 'Stock inicial configurado exitosamente',
      inventoriesCreated: results.length,
      movementsCreated: results.length, // Un movimiento por inventario
      totalQuantity,
      details: results,
    };
  }
}
