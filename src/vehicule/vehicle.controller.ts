import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe } from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicule.dto';
import { UpdateVehicleDto } from './dto/update-vehicule.dto';
import { VehicleService } from './vehicle.service';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Controller('vehicles')
export class VehicleController {

  constructor(
    private readonly vehicleService: VehicleService
  ) { }

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo vehículo' })
  @ApiResponse({ status: 201, description: 'Vehículo creado.', type: CreateVehicleDto })
  @ApiResponse({ status: 400, description: 'Entrada inválida.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código del vehículo ya existe.' })
  createVehicle(
    @Body() createVehicleDto: CreateVehicleDto
  ) {
    return this.vehicleService.createVehicle(createVehicleDto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Listar todos los vehículos o filtrar por código' })
  @ApiQuery({ name: 'code', required: false, description: 'Filtrar por código de vehículo' })
  @ApiResponse({ status: 200, description: 'Lista de vehículos.', type: [CreateVehicleDto] })
  getAllVehicles(
     @Query('code') code?: string,
  ) {
    if(code) return this.vehicleService.getVehicleByCode(code);
    return this.vehicleService.getAllVehicles();
  }

  @Get(':id')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener un vehículo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({ status: 200, description: 'Vehículo encontrado.', type: CreateVehicleDto })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  getVehicleById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.vehicleService.getVehicleById(id);
  }

  @Patch(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar un vehículo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({ status: 200, description: 'Vehículo actualizado.', type: UpdateVehicleDto })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código del vehículo ya existe.' })
  updateVehicleById(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVehicleDto: UpdateVehicleDto
  ) {
    return this.vehicleService.updateVehicleById(id, updateVehicleDto);
  }

  @Delete(':id')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Eliminar un vehículo por su ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo', type: Number })
  @ApiResponse({ status: 200, description: 'Vehículo eliminado.' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El vehículo está en uso y no puede ser eliminado.' })
  deleteVehicleById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.vehicleService.deleteVehicleById(id);
  }
}
