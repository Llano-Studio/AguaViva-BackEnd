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
    description: `Crea una nueva lista de precios con su información básica. Las listas de precios se utilizan para definir diferentes tarifas para los productos ofrecidos a los clientes.

## Sistema de Precios Diferenciados

**Tipos de Listas de Precios:**
- **Lista General/Estándar (ID: 1)**: Utilizada para compras únicas (one-off purchases)
- **Listas Específicas**: Asignadas a contratos para precios personalizados

**Flujo de Precios:**
1. **Contratos**: Usan \`client_contract.price_list_id\` → \`price_list_item.unit_price\`
2. **Compras Únicas**: Usan Lista General (ID: 1) → \`price_list_item.unit_price\`
3. **Fallback**: Si no hay precio en lista → \`product.price\` (precio base)`
  })
  @ApiBody({
    description: 'Datos de la lista de precios a crear',
    type: CreatePriceListDto,
    examples: {
      listaGeneral: {
        summary: 'Lista General/Estándar',
        description: 'Lista principal para compras públicas',
        value: {
          name: 'Lista General/Estándar',
          description: 'Lista de precios estándar para compras únicas y público general',
          is_default: true,
          active: true,
          effective_date: '2024-01-01'
        }
      },
      listaCorporativa: {
        summary: 'Lista Corporativa',
        description: 'Lista con descuentos para clientes corporativos',
        value: {
          name: 'Lista Corporativa Premium',
          description: 'Lista de precios con descuentos para clientes corporativos',
          is_default: false,
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
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda general por nombre o descripción de lista de precios' })
  @ApiQuery({ name: 'name', required: false, type: String, description: 'Filtrar por nombre específico de la lista' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filtrar por estado activo. true = solo activas, false = solo inactivas' })
  @ApiQuery({ name: 'is_default', required: false, type: Boolean, description: 'Filtrar por lista por defecto. true = solo la lista por defecto' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Campos para ordenar. Ej: name,-effective_date,is_default', example: 'name' })
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

  @Post(':id/apply-percentage')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Aplicar cambio porcentual a todos los precios de una lista',
    description: `Aplica un cambio porcentual a todos los ítems de una lista de precios específica, registrando el historial del cambio.

## Actualización Masiva de Precios

**Funcionalidad:**
- Aplica un porcentaje de aumento o descuento a todos los productos de la lista
- Registra el cambio en el historial con motivo/razón
- Mantiene trazabilidad de todos los cambios de precios
- **🔄 NUEVO**: Si es la Lista General (ID=1), también actualiza los precios de los productos individuales

**Ejemplos:**
- \`+10\`: Aumenta precios en 10%
- \`-5\`: Reduce precios en 5%
- \`+25\`: Aumenta precios en 25%

**Casos de Uso:**
- Ajustes por inflación
- Promociones estacionales
- Actualizaciones de costos por proveedores

**⚠️ IMPORTANTE para Lista General (ID=1):**
- Los precios de los productos individuales (\`product.price\`) se actualizan automáticamente
- Esto mantiene la sincronización entre lista general y precios base de productos`
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la lista de precios a actualizar',
    type: Number,
    example: 1
  })
  @ApiBody({
    description: 'Datos del cambio porcentual a aplicar',
    type: ApplyPercentageWithReasonDto,
    examples: {
      ajusteInflacion: {
        summary: 'Ajuste por Inflación',
        description: 'Aumento de precios debido a inflación',
        value: {
          percentage: 12,
          reason: 'Ajuste por inflación trimestral - Q1 2024'
        }
      },
      promocionDescuento: {
        summary: 'Promoción de Descuento',
        description: 'Descuento promocional para temporada',
        value: {
          percentage: -15,
          reason: 'Promoción especial temporada de verano'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cambio porcentual aplicado exitosamente.',
    schema: {
      properties: {
        message: { type: 'string', example: 'Cambio porcentual aplicado correctamente' },
        updated_items: { type: 'number', example: 25 },
        percentage_applied: { type: 'number', example: 10 },
        reason: { type: 'string', example: 'Ajuste por inflación trimestral - Q1 2024' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 400, description: 'Porcentaje inválido o datos incorrectos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
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
  getPriceItemHistory(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, forbidNonWhitelisted: true })) 
    paginationDto: PaginationQueryDto,
  ) {
    return this.priceListService.getPriceHistoryByItemId(itemId, paginationDto);
  }
} 