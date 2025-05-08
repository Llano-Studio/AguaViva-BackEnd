import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Listar todos los productos' })
  @ApiResponse({ status: 200, description: 'Listar todos los productos.' })
  getAllProducts() {
    return this.service.getAllProducts();
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener un producto por su id' })
  @ApiResponse({ status: 200, description: 'Producto encontrado.' })
  @ApiResponse({ status: 404, description: 'Product no encontrado.' })
  getProductById(
    @Param('id', ParseIntPipe) id: number
  ) {
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
