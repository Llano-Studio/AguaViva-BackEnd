import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { PriceListService } from './price-list.service';
import { CreatePriceListDto, UpdatePriceListDto, ApplyPercentageDto, ApplyPercentageWithReasonDto, PriceHistoryResponseDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client'; 
import { Auth } from '../auth/decorators/auth.decorator'; 

@ApiTags('Listas de Precios')
@ApiBearerAuth() 
@Controller('price-list')
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Crear una nueva lista de precios' })
  @ApiResponse({ status: 201, description: 'Lista de precios creada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  create(
    @Body() createPriceListDto: CreatePriceListDto
) {
    return this.priceListService.create(createPriceListDto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener todas las listas de precios' })
  @ApiResponse({ status: 200, description: 'Listas de precios obtenidas exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findAll() {
    return this.priceListService.findAll();
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener una lista de precios por su ID' })
  @ApiResponse({ status: 200, description: 'Lista de precios encontrada.' })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findOne(
    @Param('id', ParseIntPipe) id: number
) {
    return this.priceListService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar una lista de precios por su ID' })
  @ApiResponse({ status: 200, description: 'Lista de precios actualizada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updatePriceListDto: UpdatePriceListDto
) {
    return this.priceListService.update(id, updatePriceListDto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar una lista de precios por su ID' })
  @ApiResponse({ status: 200, description: 'Lista de precios eliminada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar la lista de precios (ej. tiene items asociados).' })
  remove(
    @Param('id', ParseIntPipe) id: number
) {
    return this.priceListService.remove(id);
  }

  @Patch(':id/apply-percentage')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Aplicar un cambio de porcentaje a todos los precios de los ítems de una lista' })
  @ApiResponse({ status: 200, description: 'Porcentaje aplicado exitosamente a los ítems de la lista.', type: [Object] })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 400, description: 'Porcentaje inválido o ningún ítem afectado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  applyPercentageChange(
    @Param('id', ParseIntPipe) id: number,
    @Body() applyPercentageDto: ApplyPercentageWithReasonDto,
  ) {
    return this.priceListService.applyPercentageChange(id, applyPercentageDto);
  }

  @Get(':id/history')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener el historial de cambios de precio de una lista de precios' })
  @ApiResponse({ status: 200, description: 'Historial de cambios encontrado.', type: [PriceHistoryResponseDto] })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getPriceListHistory(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.priceListService.getPriceListHistory(id);
  }

  @Get('item/:itemId/history')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener el historial de cambios de precio de un ítem específico' })
  @ApiResponse({ status: 200, description: 'Historial de cambios encontrado.', type: [PriceHistoryResponseDto] })
  @ApiResponse({ status: 404, description: 'Ítem de lista de precios no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getPriceItemHistory(
    @Param('itemId', ParseIntPipe) itemId: number
  ) {
    return this.priceListService.getPriceHistory(itemId);
  }
} 