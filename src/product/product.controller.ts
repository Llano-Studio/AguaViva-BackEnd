import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  Query,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { ProductResponseDto } from './dto/product-response.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { fileUploadConfigs } from '../common/utils/file-upload.util';
import { FormDataPreserveInterceptor } from '../common/interceptors/form-data-preserve.interceptor';
import { FormDataBody } from '../common/decorators/form-data-body.decorator';

@ApiTags('Productos & Artículos')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Listar productos con filtros y paginación',
    description: `Obtiene un listado paginado de productos con filtros avanzados, búsqueda inteligente y información de inventario.

## 🔍 FILTROS AVANZADOS

**Búsqueda Inteligente (search):**
- Busca en descripción del producto
- Busca en número de serie
- Busca en notas del producto
- Búsqueda parcial y sin distinción de mayúsculas

**Filtros Específicos:**
- **description**: Filtro específico por descripción
- **categoryId**: Productos de una categoría específica
- **categoryIds**: Productos de múltiples categorías (formato: "1,2,3")
- **includeInventory**: Incluye información detallada de stock por almacén

**Ordenamiento Avanzado (sortBy):**
- Múltiples campos separados por coma
- Prefijo "-" para orden descendente
- Ejemplos: "description", "-price", "description,-price"

## 📊 INFORMACIÓN INCLUIDA

**Datos del Producto:**
- Información básica (descripción, precio, volumen)
- Categoría del producto
- Stock total calculado en tiempo real
- Imagen del producto (si existe)
- Características especiales (retornable, número de serie)

**Información de Inventario (opcional):**
- Stock detallado por almacén
- Información de ubicación de almacenes
- Cantidades disponibles por ubicación

## 🎯 CASOS DE USO

- **Gestión de Inventario**: Control de stock y productos disponibles
- **Ventas y Pedidos**: Selección de productos para órdenes
- **Administración**: Gestión masiva de catálogo de productos
- **Reportes**: Análisis de productos por categoría y stock
- **Operaciones**: Planificación de entregas y recolecciones`,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Búsqueda general por descripción, número de serie o notas',
  })
  @ApiQuery({
    name: 'description',
    required: false,
    description: 'Filtrar por descripción del producto (búsqueda parcial)',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: Number,
    description: 'Filtrar por ID de categoría (para compatibilidad)',
  })
  @ApiQuery({
    name: 'categoryIds',
    required: false,
    type: String,
    description:
      "Filtrar por IDs de categorías múltiples. Formato: '1,2,3' o array [1,2,3]",
    example: '1,2,3',
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
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      "Campos para ordenar (separados por coma). Prefijo '-' para descendente. Ej: description,-price",
    example: 'description,-price',
  })
  @ApiQuery({
    name: 'includeInventory',
    required: false,
    type: Boolean,
    description: 'Incluir información detallada del inventario por almacén',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description:
      'Listado de productos paginado con información de inventario por almacén.',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ProductResponseDto' },
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
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getAllProducts(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    filterDto: FilterProductsDto,
  ) {
    return this.service.getAllProducts(filterDto);
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener un producto por su id',
    description:
      'Devuelve toda la información detallada de un producto específico según su ID, con opción de incluir inventario por almacén.',
  })
  @ApiParam({
    name: 'id',
    type: 'integer',
    description: 'ID del producto',
    example: 1,
  })
  @ApiQuery({
    name: 'includeInventory',
    required: false,
    type: Boolean,
    description: 'Incluir información detallada del inventario por almacén',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: `Producto encontrado con información de stock actualizada.

**📊 Información de Stock Incluida:**

La respuesta incluye stock actual calculado en tiempo real:
- \`total_stock\`: Stock total calculado en todos los almacenes
- \`inventory\`: Array detallado por almacén (si \`includeInventory=true\`)

**Ejemplo de Respuesta:**
\`\`\`json
{
  "product_id": 15,
  "category_id": 1,
  "description": "Agua Mineral 500ml",
  "volume_liters": 0.5,
  "price": 25.50,
  "is_returnable": true,
  "total_stock": 100,
  "serial_number": "AM-500-001",
  "notes": "Producto premium",
  "image_url": "/uploads/products/imagen123.jpg",
  "product_category": {
    "category_id": 1,
    "name": "Bebidas"
  },
  "inventory": [
    {
      "warehouse_id": 1,
      "product_id": 15,
      "quantity": 100,
      "warehouse": {
        "warehouse_id": 1,
        "name": "Almacén Principal",
        "locality": {
          "locality_id": 1,
          "name": "Centro"
        }
      }
    }
  ]
}
\`\`\`

**Para Frontend:**
- Usar \`total_stock\` para mostrar stock disponible
- Usar \`inventory\` para desglose por almacén
- Útil para formularios de actualización de stock`,
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getProductById(
    @Param('id', ParseIntPipe) id: number,
    @Query('includeInventory') includeInventory?: boolean,
  ): Promise<ProductResponseDto> {
    return this.service.getProductById(id, includeInventory);
  }

  @Post()
  @Auth(Role.SUPERADMIN)
  @UseInterceptors(
    FileInterceptor('productImage', fileUploadConfigs.productImages),
    FormDataPreserveInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Crear un nuevo producto',
    description: `Crea un nuevo producto en el sistema con imagen opcional y stock inicial. Solo disponible para administradores.

## Sistema de Precios Diferenciados - PRODUCTOS

**Integración Automática con Listas de Precios:**
- Al crear un producto, se agrega automáticamente a la Lista General/Estándar (ID: 1)
- El precio inicial en la lista será igual al \`product.price\` (precio base)
- Posteriormente se pueden ajustar precios en listas específicas

**Gestión de Stock Inicial:**
- Si se especifica \`total_stock\`, se crea automáticamente inventario en el almacén por defecto
- Se registra un movimiento de stock inicial para trazabilidad
- Si \`total_stock\` es 0 o no se especifica, el producto se crea sin inventario inicial

**Flujo de Creación:**
1. Se crea el producto con \`price\` (precio base/referencia)
2. Se crea automáticamente \`price_list_item\` en Lista General
3. Si \`total_stock > 0\`, se crea inventario inicial en almacén por defecto
4. El producto queda disponible para compras únicas con precio de lista

**Casos de Uso:**
- El \`product.price\` sirve como precio de referencia/fallback
- La Lista General define el precio público real
- Las listas específicas pueden tener precios diferentes para contratos`,
  })
  @ApiBody({
    description: `Datos del producto a crear incluyendo imagen opcional y stock inicial.

**📦 NUEVO: Gestión de Stock Inicial**

El campo \`total_stock\` permite definir inventario inicial automáticamente.

**Ejemplos de Payload:**

**1. Producto con stock inicial:**
\`\`\`json
{
  "category_id": 1,
  "description": "Agua Mineral 500ml",
  "volume_liters": 0.5,
  "price": 25.50,
  "is_returnable": true,
  "total_stock": 100,
  "serial_number": "AM-500-001",
  "notes": "Producto premium"
}
\`\`\`

**2. Producto sin stock inicial:**
\`\`\`json
{
  "category_id": 1,
  "description": "Agua Mineral 1L",
  "volume_liters": 1.0,
  "price": 45.00,
  "is_returnable": true,
  "total_stock": 0
}
\`\`\`

**3. Producto con imagen (FormData):**
- Campo: \`productImage\` (file)
- Resto de campos como JSON
`,
    type: CreateProductDto,
  })
  @ApiResponse({
    status: 201,
    description: `Producto creado exitosamente con inventario inicial (si se especificó).

**Respuesta incluye:**
- Producto creado con todos sus datos
- \`total_stock\`: Stock actual calculado del producto
- \`inventory\`: Array con inventario detallado por almacén
- Producto agregado automáticamente a Lista General de precios

**Ejemplo de Respuesta:**
\`\`\`json
{
  "product_id": 15,
  "category_id": 1,
  "description": "Agua Mineral 500ml",
  "volume_liters": 0.5,
  "price": 25.50,
  "is_returnable": true,
  "total_stock": 100,
  "serial_number": "AM-500-001",
  "notes": "Producto premium",
  "image_url": "/uploads/products/imagen123.jpg",
  "product_category": {
    "category_id": 1,
    "name": "Bebidas"
  },
  "inventory": [
    {
      "warehouse_id": 1,
      "product_id": 15,
      "quantity": 100,
      "warehouse": {
        "warehouse_id": 1,
        "name": "Almacén Principal",
        "locality": {
          "locality_id": 1,
          "name": "Centro"
        }
      }
    }
  ]
}
\`\`\``,
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos (ej. campo faltante, tipo incorrecto).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - Restricción de unicidad violada (ej. número de serie duplicado si se requiere que sea único).',
  })
  createProduct(
    @FormDataBody(CreateProductDto) dto: CreateProductDto,
    @UploadedFile() productImage?: any,
  ) {
    // DEBUG: Log para ver qué está llegando
    console.log('🔍 DEBUG - Datos recibidos en createProduct:');
    console.log(
      '  dto.is_returnable:',
      dto.is_returnable,
      typeof dto.is_returnable,
    );
    console.log('  dto completo:', JSON.stringify(dto, null, 2));

    return this.service.createProduct(dto, productImage);
  }

  @Put(':id')
  @Auth(Role.SUPERADMIN)
  @UseInterceptors(
    FileInterceptor('productImage', fileUploadConfigs.productImages),
    FormDataPreserveInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Actualizar un producto por su id',
    description: `Actualiza la información de un producto existente incluyendo imagen opcional y ajustes de stock. Solo disponible para administradores.

**Gestión de Stock en Actualización:**
- Si se especifica \`total_stock\`, se calculará la diferencia con el stock actual
- Se creará automáticamente un movimiento de ajuste (positivo o negativo)
- Si no existe inventario previo y \`total_stock > 0\`, se crea inventario inicial
- Todos los ajustes se registran en el almacén por defecto para trazabilidad`,
  })
  @ApiParam({
    name: 'id',
    type: 'integer',
    description: 'ID del producto a actualizar',
    example: 1,
  })
  @ApiBody({
    description: `Datos del producto a actualizar incluyendo imagen opcional y ajustes de stock.

**📦 NUEVO: Gestión Automática de Stock**

El campo \`total_stock\` permite ajustar el inventario automáticamente.

**⚠️ IMPORTANTE:** El sistema calcula la diferencia y genera movimientos automáticamente.

**Ejemplos de Payload:**

**1. Actualizar solo información básica (sin tocar stock):**
\`\`\`json
{
  "description": "Agua Mineral Premium 500ml",
  "price": 28.00,
  "notes": "Actualización de precio"
}
\`\`\`

**2. Ajustar stock (aumentar de 100 a 150):**
\`\`\`json
{
  "total_stock": 150
}
\`\`\`

**3. Ajustar stock (reducir de 100 a 80):**
\`\`\`json
{
  "total_stock": 80
}
\`\`\`

**4. Actualización completa:**
\`\`\`json
{
  "description": "Agua Mineral Premium 500ml",
  "price": 28.00,
  "total_stock": 120,
  "notes": "Actualización de precio y stock"
}
\`\`\`

**Para Frontend:**
- Obtener stock actual con GET /products/:id
- Mostrar stock actual vs nuevo stock en confirmación
- El backend calculará y aplicará la diferencia automáticamente
`,
    type: UpdateProductDto,
  })
  @ApiResponse({
    status: 200,
    description: `Producto actualizado exitosamente con ajustes de stock aplicados (si se especificaron).

**Respuesta incluye:**
- Producto actualizado con todos sus datos
- \`total_stock\`: Stock final después de ajustes
- \`inventory\`: Inventario actualizado por almacén
- Movimientos de stock registrados automáticamente (visibles en /inventory/movements)

**Ejemplo de Respuesta (después de ajustar stock de 100 a 150):**
\`\`\`json
{
  "product_id": 15,
  "category_id": 1,
  "description": "Agua Mineral Premium 500ml",
  "volume_liters": 0.5,
  "price": 28.00,
  "is_returnable": true,
  "total_stock": 150,
  "serial_number": "AM-500-001",
  "notes": "Actualización de precio y stock",
  "image_url": "/uploads/products/imagen123.jpg",
  "product_category": {
    "category_id": 1,
    "name": "Bebidas"
  },
  "inventory": [
    {
      "warehouse_id": 1,
      "product_id": 15,
      "quantity": 150,
      "warehouse": {
        "warehouse_id": 1,
        "name": "Almacén Principal",
        "locality": {
          "locality_id": 1,
          "name": "Centro"
        }
      }
    }
  ]
}
\`\`\`

**Movimiento generado automáticamente:**
- Tipo: "AJUSTE_POSITIVO"
- Cantidad: 50 (diferencia entre 150 y 100)
- Observaciones: "Ajuste de stock - Agua Mineral Premium 500ml. Stock anterior: 100, Stock nuevo: 150"`,
    type: ProductResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos (ej. campo faltante, tipo incorrecto).',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - Restricción de unicidad violada al actualizar (ej. número de serie duplicado si se requiere que sea único).',
  })
  updateProductById(
    @Param('id', ParseIntPipe) id: number,
    @FormDataBody(UpdateProductDto) dto: UpdateProductDto,
    @UploadedFile() productImage?: any,
  ) {
    // DEBUG: Log para ver qué está llegando
    console.log('🔍 DEBUG - Datos recibidos en updateProductById:');
    console.log(
      '  dto.is_returnable:',
      dto.is_returnable,
      typeof dto.is_returnable,
    );
    console.log('  dto completo:', JSON.stringify(dto, null, 2));

    return this.service.updateProductById(id, dto, productImage);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Eliminar un producto por su id',
    description:
      'Elimina un producto del sistema. Solo se puede eliminar productos que no estén asociados a otros registros. Solo disponible para administradores.',
  })
  @ApiParam({
    name: 'id',
    type: 'integer',
    description: 'ID del producto a eliminar',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Producto eliminado exitosamente.',
    schema: {
      properties: {
        message: { type: 'string' },
        deleted: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - El producto está en uso y no puede ser eliminado.',
  })
  deleteProductById(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteProductById(id);
  }

  @Delete(':id/image')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Eliminar imagen de un producto',
    description:
      'Elimina la imagen asociada a un producto específico. Solo disponible para administradores.',
  })
  @ApiParam({
    name: 'id',
    type: 'integer',
    description: 'ID del producto',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Imagen eliminada exitosamente.',
    type: ProductResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  deleteProductImage(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteProductImage(id);
  }

  @Get(':id/image')
  @ApiOperation({
    summary: 'Obtener URL de imagen de un producto',
    description: 'Devuelve la URL de la imagen de un producto específico.',
  })
  @ApiParam({
    name: 'id',
    type: 'integer',
    description: 'ID del producto',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'URL de imagen obtenida exitosamente.',
    schema: {
      type: 'object',
      properties: {
        product_id: { type: 'number', example: 1 },
        image_url: {
          type: 'string',
          example: '/public/uploads/products/producto-abc123.jpg',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Producto no encontrado.' })
  getProductImage(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProductImage(id);
  }
}
