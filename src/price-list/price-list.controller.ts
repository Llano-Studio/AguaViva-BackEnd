import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, ValidationPipe } from '@nestjs/common';
import { PriceListService } from './price-list.service';
import { CreatePriceListDto, UpdatePriceListDto, ApplyPercentageDto, ApplyPercentageWithReasonDto, PriceHistoryResponseDto, FilterPriceListDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody, ApiQuery, ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client'; 
import { Auth } from '../auth/decorators/auth.decorator'; 
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('Listas de Precios')
@ApiBearerAuth() 
@Controller('price-list')
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Crear una nueva lista de precios',
    description: 'Crea una nueva lista de precios con su información básica. Las listas de precios se utilizan para definir diferentes tarifas para los productos ofrecidos a los clientes.'
  })
  @ApiBody({
    description: 'Datos de la lista de precios a crear',
    type: CreatePriceListDto,
    examples: {
      example1: {
        value: {
          name: 'Lista Estándar',
          description: 'Lista de precios estándar para clientes regulares',
          is_default: true,
          active: true,
          effective_date: '2024-01-01'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Lista de precios creada exitosamente.',
    schema: {
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Lista Estándar' },
        description: { type: 'string', example: 'Lista de precios estándar para clientes regulares', nullable: true },
        is_default: { type: 'boolean', example: true },
        active: { type: 'boolean', example: true },
        effective_date: {type: 'string', format: 'date', example: '2024-01-01'},
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Ya existe una lista marcada como predeterminada.' })
  create(
    @Body(ValidationPipe) createPriceListDto: CreatePriceListDto
) {
    return this.priceListService.create(createPriceListDto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener todas las listas de precios',
    description: 'Devuelve un listado completo de todas las listas de precios disponibles en el sistema, con paginación y ordenamiento.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Listas de precios obtenidas exitosamente.',
    schema: {
        properties: {
            data: {
                type: 'array',
                items: {
                    properties: {
                        price_list_id: { type: 'number', example: 1 },
                        name: { type: 'string', example: 'Lista Estándar' },
                        effective_date: { type: 'string', format: 'date', example: '2024-01-01'},
                    }
                }
            },
            meta: {
                type: 'object',
                properties: {
                    total: { type: 'number', example: 100 },
                    page: { type: 'number', example: 1 },
                    limit: { type: 'number', example: 10 },
                    totalPages: { type: 'number', example: 10 }
                }
            }
        }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findAll(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, forbidNonWhitelisted: true })) 
    filterPriceListDto: FilterPriceListDto,
  ) {
    return this.priceListService.findAll(filterPriceListDto);
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener una lista de precios por su ID',
    description: 'Devuelve la información detallada de una lista de precios específica según su ID, incluyendo sus ítems asociados.'
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la lista de precios a consultar',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de precios encontrada exitosamente.',
    schema: {
      properties: {
        price_list_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Lista Estándar' },
        effective_date: {type: 'string', format: 'date', example: '2024-01-01'},
        price_list_items: {
          type: 'array',
          items: {
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findOne(
    @Param('id', ParseIntPipe) id: number
) {
    return this.priceListService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Actualizar una lista de precios por su ID',
    description: 'Actualiza la información básica de una lista de precios existente. No modifica los precios de los ítems asociados.'
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la lista de precios a actualizar',
    type: Number,
    example: 1
  })
  @ApiBody({
    description: 'Datos de la lista de precios a actualizar',
    type: UpdatePriceListDto,
    examples: {
      example1: {
        value: {
          name: 'Lista Estándar Actualizada',
          effective_date: '2024-02-01'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de precios actualizada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Ya existe otra lista marcada como predeterminada.' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body(ValidationPipe) updatePriceListDto: UpdatePriceListDto
) {
    return this.priceListService.update(id, updatePriceListDto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Eliminar una lista de precios por su ID',
    description: 'Elimina una lista de precios. No se puede eliminar la lista predeterminada ni listas que están siendo utilizadas.'
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la lista de precios a eliminar',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de precios eliminada exitosamente.',
    schema: {
      properties: {
        message: { type: 'string', example: 'Lista de precios eliminada correctamente' },
        deleted: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar la lista de precios predeterminada o está en uso.' })
  remove(
    @Param('id', ParseIntPipe) id: number
) {
    return this.priceListService.remove(id);
  }

  @Patch(':id/apply-percentage')
  @Auth(Role.ADMIN)
  @ApiOperation({
    summary: 'Aplicar un cambio porcentual a todos los ítems de una lista de precios',
    description: 'Aplica un incremento o decremento porcentual a todos los ítems activos de la lista de precios especificada. Registra el cambio en el historial.'
  })
  @ApiParam({ name: 'id', description: 'ID de la lista de precios', type: Number })
  @ApiBody({ type: ApplyPercentageWithReasonDto })
  @ApiResponse({ status: 200, description: 'Cambio porcentual aplicado exitosamente.' })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  applyPercentageChange(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) applyPercentageDto: ApplyPercentageWithReasonDto,
  ) {
    return this.priceListService.applyPercentageChange(id, applyPercentageDto);
  }

  @Get(':id/history')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({
    summary: 'Obtener historial de cambios de precios para una lista de precios',
    description: 'Devuelve el historial de todos los cambios de precios aplicados a los ítems de una lista de precios específica.'
  })
  @ApiParam({ name: 'id', description: 'ID de la lista de precios' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: "Campos para ordenar. Ej: change_date,-new_price", example: '-change_date' })
  @ApiResponse({ 
    status: 200, 
    description: 'Historial de precios obtenido.',
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/PriceHistoryResponseDto' } },
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        totalPages: { type: 'number', example: 10 }
      }
    }
  })
  getPriceListHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, forbidNonWhitelisted: true })) 
    paginationDto: PaginationQueryDto,
  ) {
    return this.priceListService.getPriceHistoryByPriceListId(id, paginationDto);
  }

  @Get('item/:itemId/history')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({
    summary: 'Obtener historial de cambios de un ítem de lista de precios',
    description: 'Devuelve el historial de cambios de precio para un ítem específico de una lista de precios.'
  })
  @ApiParam({ name: 'itemId', description: 'ID del ítem de la lista de precios' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: "Campos para ordenar. Ej: change_date,-new_price", example: '-change_date' })
  @ApiResponse({ 
    status: 200, 
    description: 'Historial de precios del ítem obtenido.',
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/PriceHistoryResponseDto' } },
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        totalPages: { type: 'number', example: 10 }
      }
    }
  })
  getPriceItemHistory(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, forbidNonWhitelisted: true })) 
    paginationDto: PaginationQueryDto,
  ) {
    return this.priceListService.getPriceHistoryByItemId(itemId, paginationDto);
  }
} 