import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CreateVehicleDto } from './dto/create-vehicule.dto';
import { UpdateVehicleDto } from './dto/update-vehicule.dto';
import { VehicleService } from './vehicle.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FilterVehiclesDto } from './dto/filter-vehicles.dto';
import { VehicleResponseDto, PaginatedVehicleResponseDto, AssignZonesToVehicleDto, VehicleZoneResponseDto } from './dto';

@ApiTags('Vehículos')
@ApiBearerAuth()
@Controller('vehicles')
export class VehicleController {

  constructor(
    private readonly vehicleService: VehicleService
  ) { }

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo vehículo' })
  @ApiResponse({ status: 201, description: 'Vehículo creado.', type: VehicleResponseDto })
  @ApiResponse({ status: 400, description: 'Entrada inválida.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código del vehículo ya existe.' })
  createVehicle(
    @Body(ValidationPipe) createVehicleDto: CreateVehicleDto
  ): Promise<VehicleResponseDto> {
    return this.vehicleService.createVehicle(createVehicleDto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Listar todos los vehículos o filtrar por código' })
  @ApiQuery({ name: 'search', required: false, description: 'Búsqueda general por nombre, código o descripción' })
  @ApiQuery({ name: 'code', required: false, description: 'Filtrar por código de vehículo' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Campos para ordenar. Ej: code,-name' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiResponse({ status: 200, description: 'Lista de vehículos.', type: PaginatedVehicleResponseDto })
  getAllVehicles(
     @Query(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })) filterDto: FilterVehiclesDto,
  ): Promise<PaginatedVehicleResponseDto> {
    return this.vehicleService.getAllVehicles(filterDto);
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener un vehículo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({ status: 200, description: 'Vehículo encontrado.', type: VehicleResponseDto })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  getVehicleById(
    @Param('id', ParseIntPipe) id: number
  ): Promise<VehicleResponseDto> {
    return this.vehicleService.getVehicleById(id);
  }

  @Patch(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar un vehículo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({ status: 200, description: 'Vehículo actualizado.', type: VehicleResponseDto })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código del vehículo ya existe.' })
  updateVehicleById(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateVehicleDto: UpdateVehicleDto
  ): Promise<VehicleResponseDto> {
    return this.vehicleService.updateVehicleById(id, updateVehicleDto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar un vehículo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({ status: 200, description: 'Vehículo eliminado.', schema: { properties: { message: {type: 'string'}, deleted: {type: 'boolean'}} } })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El vehículo está en uso y no puede ser eliminado.' })
  deleteVehicleById(
    @Param('id', ParseIntPipe) id: number
  ): Promise<{ message: string, deleted: boolean }> {
    return this.vehicleService.deleteVehicleById(id);
  }

  // Endpoints de gestión de zonas

  @Post(':id/zones')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Asignar zonas a un vehículo',
    description: 'Asigna una o más zonas a un vehículo para su circulación. Se pueden desactivar asignaciones previas.'
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({ 
    status: 201, 
    description: 'Zonas asignadas correctamente.', 
    type: [VehicleZoneResponseDto] 
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o zonas no encontradas.' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  assignZonesToVehicle(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Body(ValidationPipe) dto: AssignZonesToVehicleDto
  ): Promise<VehicleZoneResponseDto[]> {
    return this.vehicleService.assignZonesToVehicle(vehicleId, dto);
  }

  @Get(':id/zones')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener zonas asignadas a un vehículo',
    description: 'Lista todas las zonas donde puede circular un vehículo específico.'
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiQuery({ 
    name: 'activeOnly', 
    required: false, 
    type: Boolean, 
    description: 'Solo mostrar asignaciones activas', 
    example: true 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de zonas del vehículo.', 
    type: [VehicleZoneResponseDto] 
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  getVehicleZones(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Query('activeOnly') activeOnly?: boolean
  ): Promise<VehicleZoneResponseDto[]> {
    return this.vehicleService.getVehicleZones(vehicleId, activeOnly ?? true);
  }

  @Delete(':vehicleId/zones/:zoneId')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Remover zona de un vehículo',
    description: 'Desactiva la asignación de una zona específica a un vehículo.'
  })
  @ApiParam({ name: 'vehicleId', description: 'ID del vehículo', type: Number })
  @ApiParam({ name: 'zoneId', description: 'ID de la zona', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Zona removida correctamente.', 
    schema: { 
      properties: { 
        message: { type: 'string' }, 
        removed: { type: 'boolean' } 
      } 
    } 
  })
  @ApiResponse({ status: 404, description: 'Vehículo o asignación no encontrada.' })
  removeZoneFromVehicle(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('zoneId', ParseIntPipe) zoneId: number
  ): Promise<{ message: string, removed: boolean }> {
    return this.vehicleService.removeZoneFromVehicle(vehicleId, zoneId);
  }

  @Get(':id/users')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ 
    summary: 'Obtener usuarios que pueden manejar un vehículo',
    description: 'Lista todos los usuarios que están asignados para manejar un vehículo específico.'
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiQuery({ 
    name: 'activeOnly', 
    required: false, 
    type: Boolean, 
    description: 'Solo mostrar asignaciones activas', 
    example: true 
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
          isActive: { type: 'boolean' }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getVehicleUsers(
    @Param('id', ParseIntPipe) vehicleId: number,
    @Query('activeOnly') activeOnly?: boolean
  ) {
    return this.vehicleService.getVehicleUsers(vehicleId, activeOnly ?? true);
  }
}
