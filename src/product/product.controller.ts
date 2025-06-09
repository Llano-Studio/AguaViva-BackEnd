import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, ValidationPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ProductResponseDto } from './dto/product-response.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { fileUploadConfigs } from '../common/utils/file-upload.util';

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
  @ApiQuery({ name: 'search', required: false, description: 'Búsqueda general por descripción, número de serie o notas' })
  @ApiQuery({ name: 'description', required: false, description: 'Filtrar por descripción del producto (búsqueda parcial)' })
  @ApiQuery({ name: 'categoryId', required: false, type: Number, description: 'Filtrar por ID de categoría' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Campos para ordenar (separados por coma). Prefijo \'-\' para descendente. Ej: description,-price', example: 'description,-price' })
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
  @ApiParam({ name: 'id', type: 'integer', description: 'ID del producto', example: 1 })
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
  @UseInterceptors(FileInterceptor('productImage', fileUploadConfigs.productImages))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Crear un nuevo producto',
    description: 'Crea un nuevo producto en el sistema con imagen opcional. Solo disponible para administradores.' 
  })
  @ApiBody({ 
    description: 'Datos del producto a crear incluyendo imagen opcional', 
    type: CreateProductDto 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Producto creado exitosamente.',
    type: ProductResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (ej. campo faltante, tipo incorrecto).' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Restricción de unicidad violada (ej. número de serie duplicado si se requiere que sea único).' })
  createProduct(
    @Body() dto: CreateProductDto,
    @UploadedFile() productImage?: any
  ) {
    return this.service.createProduct(dto, productImage);
  }

  @Put(':id')
  @Auth(Role.ADMIN)
  @UseInterceptors(FileInterceptor('productImage', fileUploadConfigs.productImages))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Actualizar un producto por su id',
    description: 'Actualiza la información de un producto existente incluyendo imagen opcional. Solo disponible para administradores.' 
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID del producto a actualizar', example: 1 })
  @ApiBody({ 
    description: 'Datos del producto a actualizar incluyendo imagen opcional', 
    type: UpdateProductDto 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Producto actualizado exitosamente.',
    type: ProductResponseDto
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (ej. campo faltante, tipo incorrecto).' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Restricción de unicidad violada al actualizar (ej. número de serie duplicado si se requiere que sea único).' })
  updateProductById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
    @UploadedFile() productImage?: any
  ) {
    return this.service.updateProductById(id, dto, productImage);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Eliminar un producto por su id',
    description: 'Elimina un producto del sistema. Solo se puede eliminar productos que no estén asociados a otros registros. Solo disponible para administradores.' 
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID del producto a eliminar', example: 1 })
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

  @Delete(':id/image')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Eliminar imagen de un producto',
    description: 'Elimina la imagen asociada a un producto específico. Solo disponible para administradores.' 
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID del producto', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'Imagen eliminada exitosamente.',
    type: ProductResponseDto
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  deleteProductImage(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.service.deleteProductImage(id);
  }

  @Get(':id/image')
  @ApiOperation({ 
    summary: 'Obtener URL de imagen de un producto',
    description: 'Devuelve la URL de la imagen de un producto específico.' 
  })
  @ApiParam({ name: 'id', type: 'integer', description: 'ID del producto', example: 1 })
  @ApiResponse({ 
    status: 200, 
    description: 'URL de imagen obtenida exitosamente.',
    schema: {
      type: 'object',
      properties: {
        product_id: { type: 'number', example: 1 },
        image_url: { type: 'string', example: '/public/uploads/products/producto-abc123.jpg', nullable: true }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  getProductImage(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.service.getProductImage(id);
  }
}
