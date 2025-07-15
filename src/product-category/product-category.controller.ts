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
import { Auth } from 'src/auth/decorators/auth.decorator';
import { FilterProductCategoriesDto } from './dto/filter-product-categories.dto';

@ApiTags('Categorías de productos')
@ApiBearerAuth()
@Controller('categories')
export class ProductCategoryController {
  constructor(
    private readonly service: ProductCategoryService,
  ) {}

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ 
    summary: 'Listar todas las categorías de productos con paginación y filtros',
    description: 'Obtiene un listado de todas las categorías de productos disponibles en el sistema, permitiendo paginación, ordenamiento y filtros.'
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda general por nombre de categoría', example: 'bidones' })
  @ApiQuery({ name: 'name', required: false, type: String, description: 'Filtrar por nombre específico de categoría', example: 'Bidones' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Campo para ordenar (ej: name, -name)', example: 'name' })
  @ApiResponse({
    status: 200,
    description: 'Listado de categorías de productos obtenido exitosamente.',
    schema: {
        properties: {
            data: {
                type: 'array',
                items: {
                    properties: {
                        category_id: { type: 'number' },
                        name: { type: 'string' },
                        product: { type: 'array', items: { /* schema de producto resumido */ } }
                    }
                }
            },
            meta: {
                type: 'object',
                properties: {
                    total: { type: 'number' },
                    page: { type: 'number' },
                    limit: { type: 'number' },
                    totalPages: { type: 'number' }
                }
            }
        }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  findAll(@Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true })) filters: FilterProductCategoriesDto) {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Obtener una categoría de productos por ID',
    description: 'Devuelve la información detallada de una categoría de productos específica según su ID.'
  })
  @ApiParam({ 
    name: 'id', 
    type: 'integer', 
    description: 'ID de la categoría de productos a consultar',
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Categoría de producto encontrada exitosamente.',
    schema: {
      properties: {
        category_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones' },
        product: {
          type: 'array',
          items: {
            properties: {
              product_id: { type: 'number' },
              description: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Categoría de producto no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getProductCategoryById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getProductCategoryById(id);
  }

  @Post()
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Crear una nueva categoría de productos',
    description: 'Crea una nueva categoría para clasificar productos. Solo disponible para administradores.'
  })
  @ApiBody({ 
    description: 'Datos de la categoría a crear',
    type: CreateProductCategoryDto,
    examples: {
      example1: {
        value: {
          name: 'Bidones'
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Categoría de producto creada exitosamente.',
    schema: {
      properties: {
        category_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones' },
      }
    }
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto — La categoría de producto ya existe por nombre.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  createProductCategory(
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.service.createProductCategory(dto);
  }

  @Put(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Actualizar una categoría de productos por ID',
    description: 'Actualiza la información de una categoría de productos existente. Solo disponible para administradores.'
  })
  @ApiParam({ 
    name: 'id', 
    type: 'integer', 
    description: 'ID de la categoría de productos a actualizar'
  })
  @ApiBody({ 
    description: 'Datos de la categoría a actualizar',
    type: UpdateProductCategoryDto
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Categoría de producto actualizada exitosamente.',
    schema: {
      properties: {
        category_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones (Actualizado)' },
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Categoría de producto no encontrada.' })
  @ApiResponse({
    status: 409,
    description: 'Conflicto — El nombre de la categoría de producto ya existe.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  updateProductCategoryById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.service.updateProductCategoryById(id, dto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Eliminar una categoría de productos por ID',
    description: 'Elimina una categoría de productos del sistema. No se puede eliminar si tiene productos asociados. Solo disponible para administradores.'
  })
  @ApiParam({ 
    name: 'id', 
    type: 'integer', 
    description: 'ID de la categoría de productos a eliminar'
  })
  @ApiResponse({
    status: 200,
    description: 'Categoría de producto eliminada exitosamente.',
    schema: {
      properties: {
        message: { type: 'string', example: 'Categoría eliminada correctamente' },
        deleted: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Categoría de producto no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto - La categoría no puede ser eliminada porque tiene productos asociados.'})
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  deleteProductCategoryById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteProductCategoryById(id);
  }
}
