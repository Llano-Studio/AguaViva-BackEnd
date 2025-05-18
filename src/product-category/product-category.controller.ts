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
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Categorías de productos')
@ApiBearerAuth()
@Controller('categories')
export class ProductCategoryController {
  constructor(
    private readonly service: ProductCategoryService,
  ) {}

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ 
    summary: 'Listar todas las categorías de productos',
    description: 'Obtiene un listado de todas las categorías de productos disponibles en el sistema. Los resultados se almacenan en caché para mejorar el rendimiento.'
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de categorías de productos obtenido exitosamente.',
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'number', example: 1 },
          name: { type: 'string', example: 'Bidones' },
          description: { type: 'string', example: 'Categoría para bidones de agua', nullable: true },
          active: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getAllProductsCategory() {
    return this.service.getAllProductsCategory();
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
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
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones' },
        description: { type: 'string', example: 'Categoría para bidones de agua', nullable: true },
        active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        products: {
          type: 'array',
          items: {
            properties: {
              id: { type: 'number' },
              name: { type: 'string' }
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
  @Auth(Role.ADMIN)
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
          name: 'Bidones',
          description: 'Categoría para bidones de agua',
          active: true
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Categoría de producto creada exitosamente.',
    schema: {
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones' },
        description: { type: 'string', example: 'Categoría para bidones de agua', nullable: true },
        active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
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
  @Auth(Role.ADMIN)
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
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Bidones (Actualizado)' },
        description: { type: 'string', example: 'Categoría actualizada para bidones de agua', nullable: true },
        active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
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
  @Auth(Role.ADMIN)
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
        message: { type: 'string', example: 'Categoría eliminada correctamente' }
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
