import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, ValidationPipe, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ProductResponseDto } from './dto/product-response.dto';
import { FilterProductsDto } from './dto/filter-products.dto';

@ApiTags('Productos & Artículos')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ 
    summary: 'Listar productos con filtros y paginación', 
    description: 'Obtiene un listado paginado de productos con opciones de filtrado por nombre, categoría, estado y más.' 
  })
  @ApiQuery({ name: 'name', required: false, description: 'Filtrar por nombre de producto (búsqueda parcial)' })
  @ApiQuery({ name: 'category_id', required: false, type: Number, description: 'Filtrar por ID de categoría' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filtrar por estado activo/inactivo' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiResponse({ 
    status: 200, 
    description: 'Listado de productos paginado.', 
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ProductResponseDto' }
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
  getAllProducts(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }))
    filterDto: FilterProductsDto
  ) {
    return this.service.getAllProducts(filterDto);
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener un producto por su id',
    description: 'Devuelve toda la información detallada de un producto específico según su ID.' 
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID del producto' })
  @ApiResponse({ status: 200, description: 'Producto encontrado.', type: ProductResponseDto })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getProductById(
    @Param('id', ParseIntPipe) id: number
  ): Promise<ProductResponseDto> {
    return this.service.getProductById(id);
  }

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Crear un nuevo producto',
    description: 'Crea un nuevo producto en el sistema. Solo disponible para administradores.' 
  })
  @ApiBody({ 
    description: 'Datos del producto a crear', 
    type: CreateProductDto 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Producto creado exitosamente.',
    type: ProductResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código del producto ya existe.' })
  createProduct(
    @Body() dto: CreateProductDto
  ) {
    return this.service.createProduct(dto);
  }

  @Put(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Actualizar un producto por su id',
    description: 'Actualiza la información de un producto existente. Solo disponible para administradores.' 
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID del producto a actualizar' })
  @ApiBody({ 
    description: 'Datos del producto a actualizar', 
    type: UpdateProductDto 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Producto actualizado exitosamente.',
    type: ProductResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código del producto ya existe.' })
  updateProductById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto
  ) {
    return this.service.updateProductById(id, dto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Eliminar un producto por su id',
    description: 'Elimina un producto del sistema. Solo se puede eliminar productos que no estén asociados a otros registros. Solo disponible para administradores.' 
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID del producto a eliminar' })
  @ApiResponse({ 
    status: 200, 
    description: 'Producto eliminado exitosamente.',
    schema: {
      properties: {
        message: { type: 'string' },
        deleted: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El producto está en uso y no puede ser eliminado.' })
  deleteProductById(
    @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteProductById(id);
  }
}
