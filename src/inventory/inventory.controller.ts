import { Controller, Get, Param, ParseIntPipe, Post, Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { stock_movement as StockMovementPrisma } from '@prisma/client';
import { StockMovementResponseDto } from './dto/stock-movement-response.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Inventario')
@ApiBearerAuth()
@Auth(Role.ADMIN, Role.USER)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('product/:productId/stock')
  @ApiOperation({ 
    summary: 'Obtener el stock de un producto específico', 
    description: 'Devuelve la cantidad disponible en stock de un producto. Opcionalmente filtra por almacén específico.'
  })
  @ApiParam({ 
    name: 'productId', 
    description: 'ID del producto a consultar', 
    type: Number,
    required: true
  })
  @ApiQuery({ 
    name: 'warehouseId', 
    description: 'ID del almacén a filtrar (opcional)',
    type: Number,
    required: false
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Stock obtenido exitosamente.',
    schema: {
      properties: {
        productId: { type: 'number', example: 1 },
        warehouseId: { type: 'number', example: 2, nullable: true },
        quantity: { type: 'number', example: 100 },
        lastUpdated: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Producto o Almacén no encontrado.' })
  async getProductStock(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('warehouseId', new ParseIntPipe({ optional: true })) warehouseId?: number,
  ) {
    return this.inventoryService.getProductStock(productId, warehouseId);
  }

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Registrar un nuevo movimiento de stock', 
    description: 'Crea un nuevo movimiento de inventario afectando el stock disponible. Soporta diferentes tipos de movimientos como entradas, salidas, transferencias, ajustes, etc.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Movimiento de stock registrado exitosamente.', 
    type: StockMovementResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos de entrada inválidos (ej. cantidad no positiva, almacenes faltantes según tipo de movimiento).' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Producto, Tipo de Movimiento o Almacén no encontrado.' 
  })
  @ApiResponse({ 
    status: 422, 
    description: 'Error de validación de negocio (ej. stock insuficiente para movimientos de salida).' 
  })
  async createStockMovement(
    @Body() createStockMovementDto: CreateStockMovementDto,
  ): Promise<StockMovementPrisma> {
    return this.inventoryService.createStockMovement(createStockMovementDto);
  }
} 