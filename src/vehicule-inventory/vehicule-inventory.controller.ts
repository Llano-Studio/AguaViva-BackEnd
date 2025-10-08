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
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { VehiculeInventoryService } from './vehicule-inventory.service';
import {
  UpdateVehiculeInventoryDto,
  CreateVehiculeInventoryDto,
  FilterVehiculeInventoryDto,
  VehiculeInventoryResponseDto,
  PaginatedVehiculeInventoryResponseDto,
} from './dto';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Inventario de Vehículos')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
@Controller('vehicle-inventories')
export class VehiculeInventoryController {
  constructor(
    private readonly vehiculeInventoryService: VehiculeInventoryService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo registro de inventario de vehículo',
    description: `Registra productos en el inventario de un vehículo específico para control de stock móvil y entregas.

## 🚚 GESTIÓN DE INVENTARIO MÓVIL

**Control de Stock en Vehículos:**
- Registro de productos cargados en vehículos
- Seguimiento de cantidades llenas y vacías
- Control de stock para entregas y recolecciones
- Sincronización con inventario central

## 📦 TIPOS DE PRODUCTOS

**Productos Retornables:**
- **Bidones llenos**: Productos para entrega
- **Bidones vacíos**: Envases para recolección
- **Dispensadores**: Equipos en comodato

## 🔄 OPERACIONES AUTOMÁTICAS

**Funcionalidades del Sistema:**
- Creación o actualización automática de registros
- Validación de existencia de vehículo y producto
- Control de capacidad máxima del vehículo
- Integración con hojas de ruta

## 🎯 CASOS DE USO

- **Carga Inicial**: Preparación de vehículo para ruta
- **Reabastecimiento**: Carga adicional durante el día
- **Control de Stock**: Verificación de inventario móvil
- **Auditoría**: Seguimiento de productos en tránsito`,
  })
  @ApiBody({
    description: 'Datos para crear un registro de inventario de vehículo',
    type: CreateVehiculeInventoryDto,
    examples: {
      ejemplo1: {
        summary: 'Cargar productos en vehículo',
        value: {
          vehicle_id: 1,
          product_id: 5,
          quantity_loaded: 100,
          quantity_empty: 20,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Inventario de vehículo creado exitosamente.',
    type: VehiculeInventoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos de entrada inválidos o vehículo/producto no encontrado.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  createOrUpdateVehicleInventory(
    @Body(ValidationPipe) dto: CreateVehiculeInventoryDto,
  ): Promise<VehiculeInventoryResponseDto> {
    return this.vehiculeInventoryService.createOrUpdateVehicleInventory(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar inventarios de vehículos con filtros y paginación',
    description: `Obtiene un listado paginado de inventarios de vehículos con opciones de filtrado avanzado.

## 📊 INFORMACIÓN INCLUIDA

**Datos del Inventario:**
- Identificación del vehículo y producto
- Cantidades cargadas (llenas y vacías)
- Fechas de última actualización
- Estado del inventario móvil

## 🔍 FILTROS DISPONIBLES

**Opciones de Filtrado:**
- **Por Vehículo**: Inventario de un vehículo específico
- **Por Producto**: Distribución de un producto en la flota
- **Por Cantidad**: Vehículos con stock mínimo o máximo
- **Combinados**: Múltiples filtros simultáneos

## 📈 CASOS DE USO

- **Control de Flota**: Estado de inventario de todos los vehículos
- **Seguimiento de Producto**: Distribución específica en la flota
- **Alertas de Stock**: Vehículos con inventario bajo
- **Planificación**: Optimización de cargas y rutas
- **Auditoría**: Verificación de inventarios móviles`,
  })
  @ApiQuery({
    name: 'vehicle_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID de vehículo específico',
    example: 1,
  })
  @ApiQuery({
    name: 'product_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID de producto específico',
    example: 5,
  })
  @ApiQuery({
    name: 'min_quantity',
    required: false,
    type: Number,
    description: 'Cantidad mínima para filtrar',
    example: 10,
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
    description:
      'Lista paginada de inventarios de vehículos obtenida exitosamente.',
    type: PaginatedVehiculeInventoryResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  getAllVehicleInventory(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filterDto: FilterVehiculeInventoryDto,
  ) {
    return this.vehiculeInventoryService.getAllVehicleInventory(filterDto);
  }

  @Get(':vehicleId/:productId')
  @ApiParam({
    name: 'vehicleId',
    type: 'integer',
    description: 'ID del vehículo',
    example: 1,
  })
  @ApiParam({
    name: 'productId',
    type: 'integer',
    description: 'ID del producto',
    example: 5,
  })
  @ApiOperation({
    summary: 'Obtener inventario específico de un producto en un vehículo',
    description:
      'Devuelve los detalles del inventario de un producto específico en un vehículo determinado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventario específico encontrado exitosamente.',
    type: VehiculeInventoryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description:
      'Inventario no encontrado para el vehículo y producto especificados.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  getVehicleInventoryById(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.vehiculeInventoryService.getVehicleInventoryById(
      vehicleId,
      productId,
    );
  }

  @Patch(':vehicleId/:productId')
  @ApiParam({
    name: 'vehicleId',
    type: 'integer',
    description: 'ID del vehículo',
    example: 1,
  })
  @ApiParam({
    name: 'productId',
    type: 'integer',
    description: 'ID del producto',
    example: 5,
  })
  @ApiOperation({
    summary: 'Actualizar cantidades en inventario de vehículo',
    description:
      'Modifica las cantidades de un producto específico en el inventario de un vehículo. Útil para ajustes de stock durante entregas.',
  })
  @ApiBody({
    description: 'Datos para actualizar el inventario del vehículo',
    type: UpdateVehiculeInventoryDto,
    examples: {
      ajusteStock: {
        summary: 'Ajuste de stock después de entregas',
        value: {
          quantity_loaded: 80,
          quantity_empty: 15,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Inventario actualizado exitosamente.',
    type: VehiculeInventoryResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 404, description: 'Inventario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN.',
  })
  updateVehicleInventoryQuantities(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body(ValidationPipe) dto: UpdateVehiculeInventoryDto,
  ) {
    return this.vehiculeInventoryService.updateVehicleInventoryQuantities(
      vehicleId,
      productId,
      dto,
    );
  }

  @Delete(':vehicleId/:productId')
  @ApiParam({
    name: 'vehicleId',
    type: 'integer',
    description: 'ID del vehículo',
    example: 1,
  })
  @ApiParam({
    name: 'productId',
    type: 'integer',
    description: 'ID del producto',
    example: 5,
  })
  @ApiOperation({
    summary: 'Eliminar registro de inventario de vehículo',
    description:
      'Elimina completamente un producto del inventario de un vehículo. Esta acción es irreversible.',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventario eliminado exitosamente.',
    schema: {
      properties: {
        message: {
          type: 'string',
          example: 'Inventario eliminado correctamente',
        },
        deleted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Inventario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN.',
  })
  deleteVehicleInventoryById(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.vehiculeInventoryService.deleteVehicleInventoryById(
      vehicleId,
      productId,
    );
  }
}
