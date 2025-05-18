import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { PriceListService } from './price-list.service';
import { CreatePriceListDto, UpdatePriceListDto, ApplyPercentageDto, ApplyPercentageWithReasonDto, PriceHistoryResponseDto } from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { Role } from '@prisma/client'; 
import { Auth } from '../auth/decorators/auth.decorator'; 

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
          active: true
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
    @Body() createPriceListDto: CreatePriceListDto
) {
    return this.priceListService.create(createPriceListDto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener todas las listas de precios',
    description: 'Devuelve un listado completo de todas las listas de precios disponibles en el sistema.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Listas de precios obtenidas exitosamente.',
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'number', example: 1 },
          name: { type: 'string', example: 'Lista Estándar' },
          description: { type: 'string', example: 'Lista de precios estándar para clientes regulares', nullable: true },
          is_default: { type: 'boolean', example: true },
          active: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          items_count: { type: 'number', example: 25 }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findAll() {
    return this.priceListService.findAll();
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
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Lista Estándar' },
        description: { type: 'string', example: 'Lista de precios estándar para clientes regulares', nullable: true },
        is_default: { type: 'boolean', example: true },
        active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        items: {
          type: 'array',
          items: {
            properties: {
              id: { type: 'number', example: 101 },
              product_id: { type: 'number', example: 1 },
              product: {
                properties: {
                  id: { type: 'number', example: 1 },
                  name: { type: 'string', example: 'Bidón 20L' },
                  code: { type: 'string', example: 'BID-20L' }
                }
              },
              price: { type: 'number', example: 500 },
              active: { type: 'boolean', example: true }
            }
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
          description: 'Lista de precios actualizada para clientes regulares',
          is_default: true,
          active: true
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de precios actualizada exitosamente.',
    schema: {
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Lista Estándar Actualizada' },
        description: { type: 'string', example: 'Lista de precios actualizada para clientes regulares', nullable: true },
        is_default: { type: 'boolean', example: true },
        active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Ya existe otra lista marcada como predeterminada.' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updatePriceListDto: UpdatePriceListDto
) {
    return this.priceListService.update(id, updatePriceListDto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Eliminar una lista de precios por su ID',
    description: 'Elimina una lista de precios y opcionalmente todos sus ítems asociados. No se puede eliminar la lista predeterminada ni listas que están siendo utilizadas por contratos o clientes.'
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
  @ApiResponse({ status: 400, description: 'No se puede eliminar la lista de precios predeterminada.' })
  @ApiResponse({ status: 409, description: 'Conflicto - La lista de precios está en uso por contratos o clientes.' })
  remove(
    @Param('id', ParseIntPipe) id: number
) {
    return this.priceListService.remove(id);
  }

  @Patch(':id/apply-percentage')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Aplicar un cambio de porcentaje a todos los precios de los ítems de una lista',
    description: 'Permite aumentar o disminuir todos los precios de una lista por un porcentaje específico. Útil para aplicar aumentos generales de precios o descuentos.'
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la lista de precios a modificar',
    type: Number,
    example: 1
  })
  @ApiBody({
    description: 'Datos para el cambio porcentual',
    type: ApplyPercentageWithReasonDto,
    examples: {
      increase: {
        summary: 'Aumento del 10%',
        value: {
          percentage: 10,
          reason: 'Ajuste por inflación'
        }
      },
      decrease: {
        summary: 'Descuento del 5%',
        value: {
          percentage: -5,
          reason: 'Promoción temporal'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Porcentaje aplicado exitosamente a los ítems de la lista.',
    schema: {
      properties: {
        updated_count: { type: 'number', example: 25 },
        message: { type: 'string', example: 'Se aplicó un aumento del 10% a 25 productos' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 400, description: 'Porcentaje inválido o ningún ítem afectado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  applyPercentageChange(
    @Param('id', ParseIntPipe) id: number,
    @Body() applyPercentageDto: ApplyPercentageWithReasonDto,
  ) {
    return this.priceListService.applyPercentageChange(id, applyPercentageDto);
  }

  @Get(':id/history')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener el historial de cambios de precio de una lista de precios',
    description: 'Devuelve un registro histórico de todos los cambios de precios realizados en una lista específica, ordenados cronológicamente.'
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la lista de precios',
    type: Number,
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Historial de cambios encontrado exitosamente.',
    type: [PriceHistoryResponseDto],
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'number', example: 1 },
          price_list_item_id: { type: 'number', example: 101 },
          product_id: { type: 'number', example: 1 },
          product_name: { type: 'string', example: 'Bidón 20L' },
          old_price: { type: 'number', example: 450 },
          new_price: { type: 'number', example: 500 },
          change_date: { type: 'string', format: 'date-time' },
          change_percentage: { type: 'number', example: 11.11 },
          reason: { type: 'string', example: 'Ajuste por inflación', nullable: true },
          changed_by: { type: 'string', example: 'admin@example.com' }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getPriceListHistory(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.priceListService.getPriceListHistory(id);
  }

  @Get('item/:itemId/history')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener el historial de cambios de precio de un ítem específico',
    description: 'Devuelve un registro histórico de todos los cambios de precio realizados en un ítem específico de una lista de precios, ordenados cronológicamente.'
  })
  @ApiParam({
    name: 'itemId',
    description: 'ID del ítem de lista de precios',
    type: Number,
    example: 101
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Historial de cambios encontrado exitosamente.',
    type: [PriceHistoryResponseDto],
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'number', example: 1 },
          price_list_item_id: { type: 'number', example: 101 },
          product_id: { type: 'number', example: 1 },
          product_name: { type: 'string', example: 'Bidón 20L' },
          old_price: { type: 'number', example: 450 },
          new_price: { type: 'number', example: 500 },
          change_date: { type: 'string', format: 'date-time' },
          change_percentage: { type: 'number', example: 11.11 },
          reason: { type: 'string', example: 'Ajuste por inflación', nullable: true },
          changed_by: { type: 'string', example: 'admin@example.com' }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Ítem de lista de precios no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getPriceItemHistory(
    @Param('itemId', ParseIntPipe) itemId: number
  ) {
    return this.priceListService.getPriceHistory(itemId);
  }
} 