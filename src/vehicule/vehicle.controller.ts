import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CreateVehicleDto } from './dto/create-vehicule.dto';
import { UpdateVehicleDto } from './dto/update-vehicule.dto';
import { VehicleService } from './vehicle.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FilterVehiclesDto } from './dto/filter-vehicles.dto';
import {
  VehicleResponseDto,
  PaginatedVehicleResponseDto,
  AssignZonesToVehicleDto,
  VehicleZoneResponseDto,
} from './dto';

@ApiTags('Vehículos')
@ApiBearerAuth()
@Controller('vehicles')
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post()
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Registrar nuevo vehículo en la flota',
    description: `Registra un nuevo vehículo en el sistema de gestión de flota para entregas y operaciones logísticas.

## 🚚 GESTIÓN DE FLOTA

**Información del Vehículo:**
- Código único identificador
- Nombre descriptivo del vehículo
- Especificaciones técnicas
- Capacidad de carga
- Estado operativo

## 📋 DATOS REQUERIDOS

**Campos Obligatorios:**
- **Código**: Identificador único (ej: VH-001)
- **Nombre**: Descripción del vehículo
- **Capacidad**: Límite de carga en unidades
- **Estado**: Activo/Inactivo para operaciones

## 🔧 CONFIGURACIÓN INICIAL

**Después del Registro:**
- Asignación de zonas de circulación
- Asignación de conductores autorizados
- Configuración de inventario móvil
- Integración con hojas de ruta

## 🎯 CASOS DE USO

- **Expansión de Flota**: Nuevos vehículos de entrega
- **Reemplazo de Unidades**: Actualización de flota
- **Especialización**: Vehículos para zonas específicas
- **Control Operativo**: Gestión centralizada de recursos`,
  })
  @ApiResponse({
    status: 201,
    description: 'Vehículo registrado exitosamente en la flota.',
    type: VehicleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o incompletos.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - Ya existe un vehículo con el mismo código.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - Solo usuarios SUPERADMIN pueden crear vehículos.',
  })
  createVehicle(
    @Body(ValidationPipe) createVehicleDto: CreateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return this.vehicleService.createVehicle(createVehicleDto);
  }

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Listar vehículos de la flota con filtros y paginación',
    description: `Obtiene un listado paginado de vehículos con opciones de filtrado avanzado y búsqueda inteligente.

## 🚚 GESTIÓN DE FLOTA

**Información Incluida:**
- Datos básicos del vehículo (ID, código, nombre)
- Descripción y especificaciones técnicas
- Estado operativo y disponibilidad
- Metadatos de registro y actualización

## 🔍 FILTROS DISPONIBLES

**Búsqueda Inteligente:**
- **search**: Búsqueda general por nombre, código o descripción
- **code**: Filtro específico por código de vehículo

**Ordenamiento Avanzado:**
- **sortBy**: Múltiples campos de ordenamiento
  - Ejemplos: \`code\`, \`-name\`, \`code,-name\`
  - Prefijo \`-\` para orden descendente

## 📊 INFORMACIÓN INCLUIDA

**Datos del Vehículo:**
- **Identificación**: ID único y código interno
- **Descripción**: Nombre, modelo y especificaciones
- **Estado**: Disponibilidad operativa
- **Metadatos**: Fechas de registro y modificación

## 🎯 CASOS DE USO

- **Gestión de Flota**: Control general de vehículos disponibles
- **Asignación de Rutas**: Selección de vehículos para entregas
- **Mantenimiento**: Identificación de vehículos para servicio
- **Reportes Operativos**: Análisis de utilización de flota
- **Administración**: Gestión centralizada de recursos móviles`,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Búsqueda general por nombre, código o descripción del vehículo',
    example: 'Mercedes',
  })
  @ApiQuery({
    name: 'code',
    required: false,
    description: 'Filtrar por código específico de vehículo',
    example: 'TRK-001',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description:
      'Campos para ordenar. Usar prefijo "-" para orden descendente. Ej: code,-name',
    example: 'code,-name',
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
    description: 'Cantidad de resultados por página (máximo 100)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista paginada de vehículos de la flota con información completa.',
    type: PaginatedVehicleResponseDto,
  })
  getAllVehicles(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filterDto: FilterVehiclesDto,
  ): Promise<PaginatedVehicleResponseDto> {
    return this.vehicleService.getAllVehicles(filterDto);
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener información detallada de un vehículo específico',
    description: `Recupera la información completa de un vehículo específico de la flota por su ID único.

## 🚚 INFORMACIÓN DEL VEHÍCULO

**Datos Incluidos:**
- **Identificación**: ID único y código interno del vehículo
- **Descripción**: Nombre, modelo y especificaciones técnicas
- **Estado**: Disponibilidad operativa actual
- **Metadatos**: Fechas de registro y última modificación

## 📋 DETALLES OPERATIVOS

**Información Disponible:**
- Código único identificador para referencias rápidas
- Nombre descriptivo con marca y modelo
- Descripción detallada con características técnicas
- Estado de disponibilidad para asignaciones

## 🎯 CASOS DE USO

- **Consulta Específica**: Verificación de datos de un vehículo particular
- **Asignación de Rutas**: Validación antes de asignar a hojas de ruta
- **Mantenimiento**: Consulta para programación de servicios
- **Administración**: Gestión individual de vehículos de la flota
- **Auditoría**: Verificación de información registrada`,
  })
  @ApiParam({
    name: 'id',
    description: 'ID único del vehículo a consultar',
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Información completa del vehículo encontrado.',
    type: VehicleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description:
      'Vehículo no encontrado - El ID especificado no existe en la base de datos.',
  })
  getVehicleById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<VehicleResponseDto> {
    return this.vehicleService.getVehicleById(id);
  }

  @Patch(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Actualizar un vehículo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Vehículo actualizado.',
    type: VehicleResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - El código del vehículo ya existe.',
  })
  updateVehicleById(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateVehicleDto: UpdateVehicleDto,
  ): Promise<VehicleResponseDto> {
    return this.vehicleService.updateVehicleById(id, updateVehicleDto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({ summary: 'Eliminar un vehículo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Vehículo eliminado.',
    schema: {
      properties: { message: { type: 'string' }, deleted: { type: 'boolean' } },
    },
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - El vehículo está en uso y no puede ser eliminado.',
  })
  deleteVehicleById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string; deleted: boolean }> {
    return this.vehicleService.deleteVehicleById(id);
  }

  // Endpoints de gestión de zonas

  @Post(':id/zones')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Asignar zonas a un vehículo',
    description:
      'Asigna una o más zonas a un vehículo para su circulación. Se pueden desactivar asignaciones previas.',
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Zonas asignadas correctamente.',
    type: [VehicleZoneResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o zonas no encontradas.',
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  assignZonesToVehicle(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Body(ValidationPipe) dto: AssignZonesToVehicleDto,
  ): Promise<VehicleZoneResponseDto[]> {
    return this.vehicleService.assignZonesToVehicle(vehicleId, dto);
  }

  @Get(':id/zones')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener zonas asignadas a un vehículo',
    description:
      'Lista todas las zonas donde puede circular un vehículo específico.',
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Solo mostrar asignaciones activas',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de zonas del vehículo.',
    type: [VehicleZoneResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  getVehicleZones(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Query('activeOnly') activeOnly?: boolean,
  ): Promise<VehicleZoneResponseDto[]> {
    return this.vehicleService.getVehicleZones(vehicleId, activeOnly ?? true);
  }

  @Delete(':vehicleId/zones/:zoneId')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Remover zona de un vehículo',
    description:
      'Desactiva la asignación de una zona específica a un vehículo.',
  })
  @ApiParam({ name: 'vehicleId', description: 'ID del vehículo', type: Number })
  @ApiParam({ name: 'zoneId', description: 'ID de la zona', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Zona removida correctamente.',
    schema: {
      properties: {
        message: { type: 'string' },
        removed: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Vehículo o asignación no encontrada.',
  })
  removeZoneFromVehicle(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('zoneId', ParseIntPipe) zoneId: number,
  ): Promise<{ message: string; removed: boolean }> {
    return this.vehicleService.removeZoneFromVehicle(vehicleId, zoneId);
  }

  @Get(':id/users')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener usuarios que pueden manejar un vehículo',
    description:
      'Lista todos los usuarios que están asignados para manejar un vehículo específico.',
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Solo mostrar asignaciones activas',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios del vehículo obtenida exitosamente',
    schema: {
      type: 'array',
      items: {
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getVehicleUsers(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Query('activeOnly') activeOnly?: boolean,
  ) {
    return this.vehicleService.getVehicleUsers(vehicleId, activeOnly ?? true);
  }
}
