import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { PriceListItemService } from './price-list-item.service';
import {
  CreatePriceListItemDto,
  UpdatePriceListItemDto,
  PriceListItemResponseDto,
  PaginatedPriceListItemResponseDto,
  FilterPriceListItemDto,
} from './dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Ítems de lista de precios')
@ApiBearerAuth()
@Controller('price-list-item')
export class PriceListItemController {
  constructor(private readonly priceListItemService: PriceListItemService) {}

  @Post()
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Crear un nuevo ítem en una lista de precios',
    description: `Crea un nuevo ítem en una lista de precios específica.

**🔄 NUEVO - Sincronización con Lista General (ID=1):**
- Si se crea un ítem en la Lista General (ID=1), el precio del producto individual se actualiza automáticamente
- Mantiene sincronización entre \`price_list_item.unit_price\` y \`product.price\` para la lista general`,
  })
  @ApiBody({ type: CreatePriceListItemDto })
  @ApiResponse({
    status: 201,
    description: 'Ítem de lista de precios creado exitosamente.',
    type: PriceListItemResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos (ej. producto o lista no existen, o el producto ya está en la lista).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - Este producto ya existe en esta lista de precios.',
  })
  create(
    @Body(ValidationPipe) createPriceListItemDto: CreatePriceListItemDto,
  ): Promise<PriceListItemResponseDto> {
    return this.priceListItemService.create(createPriceListItemDto);
  }

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener todos los ítems de todas las listas de precios',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      'Campos para ordenar. Campos de producto: product.description, product.code. Campos de lista: price_list.name. Campos directos: unit_price, price_list_item_id. Ej: product.description,-unit_price',
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
  @ApiResponse({
    status: 200,
    description: 'Ítems de listas de precios obtenidos exitosamente.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            properties: {
              price_list_item_id: { type: 'number', example: 1 },
              price_list_id: { type: 'number', example: 1 },
              product_id: { type: 'number', example: 1 },
              unit_price: { type: 'number', format: 'float', example: 15.5 },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 100 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 10 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filterDto: FilterPriceListItemDto,
  ) {
    return this.priceListItemService.findAll(filterDto);
  }

  @Get('by-list/:priceListId')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener todos los ítems de una lista de precios específica',
  })
  @ApiParam({
    name: 'priceListId',
    description: 'ID de la lista de precios',
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      'Campos para ordenar. Campos de producto: product.description, product.code. Campos directos: unit_price, price_list_item_id. Ej: product.description,-unit_price',
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
  @ApiResponse({
    status: 200,
    description: 'Ítems de la lista de precios obtenidos exitosamente.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            properties: {
              price_list_item_id: { type: 'number', example: 1 },
              price_list_id: { type: 'number', example: 1 },
              product_id: { type: 'number', example: 1 },
              unit_price: { type: 'number', format: 'float', example: 15.5 },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 100 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 10 },
            totalPages: { type: 'number', example: 10 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Lista de precios no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findAllByPriceList(
    @Param('priceListId', ParseIntPipe) priceListId: number,
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filterDto: FilterPriceListItemDto,
  ) {
    return this.priceListItemService.findAllByPriceListId(
      priceListId,
      filterDto,
    );
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener un ítem de lista de precios por su ID' })
  @ApiParam({
    name: 'id',
    description: 'ID del ítem de lista de precios',
    type: Number,
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Ítem de lista de precios encontrado.',
    type: PriceListItemResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Ítem de lista de precios no encontrado.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PriceListItemResponseDto> {
    return this.priceListItemService.findOne(id);
  }

  @Patch(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary:
      'Actualizar un ítem de lista de precios por su ID (solo precio unitario)',
    description: `Actualiza el precio unitario de un ítem específico en una lista de precios.

**🔄 NUEVO - Sincronización con Lista General (ID=1):**
- Si se actualiza un ítem de la Lista General (ID=1), el precio del producto individual se actualiza automáticamente
- Mantiene sincronización entre \`price_list_item.unit_price\` y \`product.price\` para la lista general`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID del ítem de lista de precios a actualizar',
    type: Number,
    example: 101,
  })
  @ApiBody({
    type: UpdatePriceListItemDto,
    description: "Solo se puede actualizar el 'unit_price'.",
  })
  @ApiResponse({
    status: 200,
    description: 'Ítem de lista de precios actualizado exitosamente.',
    type: PriceListItemResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Ítem de lista de precios no encontrado.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos (ej. precio negativo) o no se proporcionaron cambios.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updatePriceListItemDto: UpdatePriceListItemDto,
  ): Promise<PriceListItemResponseDto> {
    return this.priceListItemService.update(id, updatePriceListItemDto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Eliminar un ítem de lista de precios por su ID' })
  @ApiParam({
    name: 'id',
    description: 'ID del ítem de lista de precios a eliminar',
    type: Number,
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Ítem de lista de precios eliminado exitosamente.',
    schema: {
      properties: {
        message: {
          type: 'string',
          example: 'Ítem de lista de precios eliminado correctamente.',
        },
        deleted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Ítem de lista de precios no encontrado.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    return this.priceListItemService.remove(id);
  }
}
