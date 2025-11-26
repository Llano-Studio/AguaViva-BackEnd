import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseInterceptors,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { FilterProductCategoriesDto } from './dto/filter-product-categories.dto';
import { BUSINESS_CONFIG } from '../common/config/business.config';

@ApiTags('📦 Productos & Artículos')
@ApiBearerAuth()
@Controller('categories')
export class ProductCategoryController {
  constructor(private readonly service: ProductCategoryService) {}

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Listar categorías de productos con filtros y paginación',
    description: `Obtiene un listado paginado de categorías de productos con opciones de filtrado avanzado y búsqueda inteligente.

## 📂 GESTIÓN DE CATEGORÍAS

**Información Incluida:**
- Datos básicos de la categoría (ID, nombre)
- Lista de productos asociados a cada categoría
- Metadatos de paginación y ordenamiento
- Información relacional con productos

## 🔍 FILTROS DISPONIBLES

**Búsqueda Inteligente:**
- **search**: Búsqueda general por nombre de categoría (parcial, sin distinción de mayúsculas)
- **name**: Filtro específico por nombre exacto de categoría

**Ordenamiento Avanzado:**
- **sortBy**: Campos de ordenamiento disponibles
  - Ejemplos: \`name\`, \`-name\`, \`category_id\`
  - Prefijo \`-\` para orden descendente

## 📊 INFORMACIÓN INCLUIDA

**Datos de la Categoría:**
- **Identificación**: ID único y nombre de la categoría
- **Productos Asociados**: Lista de productos que pertenecen a la categoría
- **Relaciones**: Información completa de productos vinculados
- **Metadatos**: Información de paginación y totales

## 🎯 CASOS DE USO

- **Gestión de Catálogo**: Organización y clasificación de productos
- **Filtrado de Productos**: Selección por categorías específicas
- **Reportes Comerciales**: Análisis de productos por categoría
- **Administración**: Gestión centralizada de clasificaciones
- **Inventario**: Control de stock por categorías de productos`,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Búsqueda general por nombre de categoría (búsqueda parcial)',
    example: 'bidones',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filtrar por nombre específico de categoría (búsqueda exacta)',
    example: 'Bidones Retornables',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página para paginación',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `Cantidad de resultados por página (máximo ${BUSINESS_CONFIG.PAGINATION.MAX_LIMIT})`,
    example: BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      'Campo para ordenar. Usar prefijo "-" para orden descendente (ej: name, -name)',
    example: 'name',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista paginada de categorías de productos con productos asociados.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: {
            properties: {
              category_id: { type: 'number' },
              name: { type: 'string' },
              product: {
                type: 'array',
                items: {
                  /* schema de producto resumido */
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'page debe ser un número positivo',
            `limit no puede ser mayor a ${BUSINESS_CONFIG.PAGINATION.MAX_LIMIT}`,
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Token inválido o expirado' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'No tienes permisos para acceder a este recurso',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  findAll(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
      }),
    )
    filters: FilterProductCategoriesDto,
  ) {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener información detallada de una categoría específica',
    description: `Recupera la información completa de una categoría de productos específica por su ID único, incluyendo todos los productos asociados.

## 📂 INFORMACIÓN DE LA CATEGORÍA

**Datos Incluidos:**
- **Identificación**: ID único y nombre de la categoría
- **Productos Asociados**: Lista completa de productos que pertenecen a esta categoría
- **Detalles de Productos**: Información básica de cada producto vinculado
- **Relaciones**: Estructura completa de la categoría con sus productos

## 📋 DETALLES INCLUIDOS

**Información de la Categoría:**
- ID único identificador de la categoría
- Nombre descriptivo de la categoría
- Lista de productos asociados con sus detalles básicos

**Información de Productos Asociados:**
- ID único de cada producto
- Descripción del producto
- Información adicional según disponibilidad

## 🎯 CASOS DE USO

- **Consulta Específica**: Verificación de datos de una categoría particular
- **Gestión de Productos**: Visualización de productos por categoría
- **Administración**: Gestión individual de categorías del catálogo
- **Reportes**: Análisis detallado de productos por categoría específica
- **Validación**: Verificación de relaciones entre categorías y productos`,
  })
  @ApiParam({
    name: 'id',
    type: 'integer',
    description: 'ID único de la categoría de productos a consultar',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description:
      'Información completa de la categoría encontrada con productos asociados.',
    schema: {
      properties: {
        category_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones Retornables' },
        product: {
          type: 'array',
          items: {
            properties: {
              product_id: { type: 'number' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'ID de categoría inválido',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'El ID debe ser un número válido' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Token inválido o expirado' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'No tienes permisos para acceder a este recurso',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Categoría de producto no encontrada',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          example: 'Categoría con ID 123 no encontrada',
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  getProductCategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProductCategoryById(id);
  }

  @Post()
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Crear una nueva categoría de productos',
    description:
      'Crea una nueva categoría para clasificar productos. Solo disponible para administradores.',
  })
  @ApiBody({
    description: 'Datos de la categoría a crear',
    type: CreateProductCategoryDto,
    examples: {
      example1: {
        value: {
          name: 'Bidones',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Categoría de producto creada exitosamente.',
    schema: {
      properties: {
        category_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto — La categoría de producto ya existe por nombre.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  createProductCategory(@Body() dto: CreateProductCategoryDto) {
    return this.service.createProductCategory(dto);
  }

  @Put(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Actualizar una categoría de productos por ID',
    description:
      'Actualiza la información de una categoría de productos existente. Solo disponible para administradores.',
  })
  @ApiParam({
    name: 'id',
    type: 'integer',
    description: 'ID de la categoría de productos a actualizar',
  })
  @ApiBody({
    description: 'Datos de la categoría a actualizar',
    type: UpdateProductCategoryDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Categoría de producto actualizada exitosamente.',
    schema: {
      properties: {
        category_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones (Actualizado)' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Categoría de producto no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto — El nombre de la categoría de producto ya existe.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  updateProductCategoryById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.service.updateProductCategoryById(id, dto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Eliminar una categoría de productos por ID',
    description:
      'Elimina una categoría de productos del sistema. No se puede eliminar si tiene productos asociados. Solo disponible para administradores.',
  })
  @ApiParam({
    name: 'id',
    type: 'integer',
    description: 'ID de la categoría de productos a eliminar',
  })
  @ApiResponse({
    status: 200,
    description: 'Categoría de producto eliminada exitosamente.',
    schema: {
      properties: {
        message: {
          type: 'string',
          example: 'Categoría eliminada correctamente',
        },
        deleted: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Categoría de producto no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - La categoría no puede ser eliminada porque tiene productos asociados.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  deleteProductCategoryById(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteProductCategoryById(id);
  }
}
