import { Controller, Get, Param, ParseIntPipe, Post, Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Obtener el stock de un producto específico, opcionalmente por almacén' })
  @ApiResponse({ status: 200, description: 'Stock obtenido exitosamente.'})
  @ApiResponse({ status: 404, description: 'Producto o Almacén no encontrado.'})
  @ApiParam({ name: 'productId', description: 'ID del producto', type: Number })
  async getProductStock(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('warehouseId', new ParseIntPipe({ optional: true })) warehouseId?: number,
  ) {
    return this.inventoryService.getProductStock(productId, warehouseId);
  }

  @Post('movements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar un nuevo movimiento de stock' })
  @ApiResponse({ status: 201, description: 'Movimiento de stock registrado exitosamente.', type: StockMovementResponseDto })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (ej. cantidad no positiva, almacenes faltantes según tipo).' })
  @ApiResponse({ status: 404, description: 'Producto, Tipo de Movimiento o Almacén no encontrado.' })
  async createStockMovement(
    @Body() createStockMovementDto: CreateStockMovementDto,
  ): Promise<StockMovementPrisma> {
    return this.inventoryService.createStockMovement(createStockMovementDto);
  }
} 