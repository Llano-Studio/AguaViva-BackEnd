import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Categories')
@Auth(Role.ADMIN, Role.USER)
@Controller('categories')
export class ProductCategoryController {
  constructor(
    private readonly service: ProductCategoryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas las categorías de productos' })
  @ApiResponse({
    status: 200,
    description: 'Listado de categorías de productos',
  })
  getAllProductsCategory() {
    return this.service.getAllProductsCategory();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una categoría de productos por ID' })
  @ApiResponse({ status: 200, description: 'Categoria de producto encontrada.' })
  @ApiResponse({ status: 404, description: 'Categoria de producto no encontrada' })
  getProductCategoryById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getProductCategoryById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva categoría de productos' })
  @ApiResponse({
    status: 201,
    description: 'Categoría de producto creada exitosamente.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflictoso — La categoría de producto ya existe.',
  })
  createProductCategory(
    @Body() dto: CreateProductCategoryDto,
  ) {
    return this.service.createProductCategory(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una categoría de productos por ID' })
  @ApiResponse({ status: 200, description: 'Categoria de producto actualizada.' })
  @ApiResponse({ status: 404, description: 'Categoria de producto no encontrada.' })
  @ApiResponse({
    status: 409,
    description: 'Conflicto — La categoría de producto ya existe.',
  })
  updateProductCategoryById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.service.updateProductCategoryById(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una categoría de productos por ID' })
  @ApiResponse({
    status: 200,
    description: 'Categoría de producto eliminada exitosamente.',
  })
  @ApiResponse({ status: 404, description: 'Categoría de producto no encontrada.' })
  deleteProductCategoryById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.deleteProductCategoryById(id);
  }
}
