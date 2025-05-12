import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Query, ValidationPipe, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Listar productos con filtros y paginación' })
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
  getAllProducts(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true } }))
    filterDto: FilterProductsDto
  ) {
    return this.service.getAllProducts(filterDto);
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener un producto por su id' })
  @ApiResponse({ status: 200, description: 'Producto encontrado.', type: ProductResponseDto })
  @ApiResponse({ status: 404, description: 'Product no encontrado.' })
  getProductById(
    @Param('id', ParseIntPipe) id: number
  ): Promise<ProductResponseDto> {
    return this.service.getProductById(id);
  }

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo producto' })
  @ApiResponse({ status: 201, description: 'Producto creado.' })
  createProduct(
    @Body() dto: CreateProductDto
  ) {
    return this.service.createProduct(dto);
  }

  @Put(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar un producto por su id' })
  @ApiResponse({ status: 200, description: 'Producto actualizado.' })
  updateProductById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto
  ) {
    return this.service.updateProductById(id, dto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar un producto por su id' })
  @ApiResponse({ status: 200, description: 'Producto eliminado.' })
  deleteProductById(
    @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteProductById(id);
  }
}
