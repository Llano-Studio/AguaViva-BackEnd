import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { PriceListItemService } from './price-list-item.service';
import { CreatePriceListItemDto, UpdatePriceListItemDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Ítems de lista de precios')
@ApiBearerAuth()
@Controller('price-list-item')
export class PriceListItemController {
    constructor(private readonly priceListItemService: PriceListItemService) { }

    @Post()
    @Auth(Role.ADMIN)
    @ApiOperation({ summary: 'Crear un nuevo ítem en una lista de precios' })
    @ApiResponse({ status: 201, description: 'Ítem de lista de precios creado exitosamente.' })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (ej. producto o lista no existen, o el producto ya está en la lista).' })
    @ApiResponse({ status: 401, description: 'No autorizado.' })
    create(
        @Body() createPriceListItemDto: CreatePriceListItemDto
    ) {
        return this.priceListItemService.create(createPriceListItemDto);
    }

    @Get()
    @Auth(Role.ADMIN, Role.USER)
    @ApiOperation({ summary: 'Obtener todos los ítems de todas las listas de precios' })
    @ApiResponse({ status: 200, description: 'Ítems de listas de precios obtenidos exitosamente.' })
    @ApiResponse({ status: 401, description: 'No autorizado.' })
    findAll() {
        return this.priceListItemService.findAll();
    }

    @Get('by-list/:priceListId')
    @Auth(Role.ADMIN, Role.USER)
    @ApiOperation({ summary: 'Obtener todos los ítems de una lista de precios específica' })
    @ApiResponse({ status: 200, description: 'Ítems de la lista de precios obtenidos exitosamente.' })
    @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
    @ApiResponse({ status: 401, description: 'No autorizado.' })
    findAllByPriceList(
        @Param('priceListId', ParseIntPipe) priceListId: number
    ) {
        return this.priceListItemService.findAllByPriceListId(priceListId);
    }

    @Get(':id')
    @Auth(Role.ADMIN, Role.USER)
    @ApiOperation({ summary: 'Obtener un ítem de lista de precios por su ID' })
    @ApiResponse({ status: 200, description: 'Ítem de lista de precios encontrado.' })
    @ApiResponse({ status: 404, description: 'Ítem de lista de precios no encontrado.' })
    @ApiResponse({ status: 401, description: 'No autorizado.' })
    findOne(
        @Param('id', ParseIntPipe) id: number
    ) {
        return this.priceListItemService.findOne(id);
    }

    @Patch(':id')
    @Auth(Role.ADMIN)
    @ApiOperation({ summary: 'Actualizar un ítem de lista de precios por su ID' })
    @ApiResponse({ status: 200, description: 'Ítem de lista de precios actualizado exitosamente.' })
    @ApiResponse({ status: 404, description: 'Ítem de lista de precios no encontrado.' })
    @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
    @ApiResponse({ status: 401, description: 'No autorizado.' })
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updatePriceListItemDto: UpdatePriceListItemDto
    ) {
        return this.priceListItemService.update(id, updatePriceListItemDto);
    }

    @Delete(':id')
    @Auth(Role.ADMIN)
    @ApiOperation({ summary: 'Eliminar un ítem de lista de precios por su ID' })
    @ApiResponse({ status: 200, description: 'Ítem de lista de precios eliminado exitosamente.' })
    @ApiResponse({ status: 404, description: 'Ítem de lista de precios no encontrado.' })
    @ApiResponse({ status: 401, description: 'No autorizado.' })
    remove(
        @Param('id', ParseIntPipe) id: number
    ) {
        return this.priceListItemService.remove(id);
    }
} 