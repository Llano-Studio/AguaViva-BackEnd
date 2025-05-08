import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VehicleInventoryService } from './vehicule-inventory.service';
import { UpdateVehicleInventoryDto } from './dto/update-vehicule-inventory.dto';
import { CreateVehicleInventoryDto } from './dto/create-vehicule-inventory.dto';
import { Role } from '@prisma/client';
import { Auth } from 'src/auth/decorators/auth.decorator';

@ApiTags('Vehicle Inventories')
@ApiBearerAuth()
@Controller('vehicle-inventories')
export class VehicleInventoryController {
  constructor(private readonly service: VehicleInventoryService) {}

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Crear o actualizar un registro de inventario de vehículo' })
  @ApiResponse({ status: 201, description: 'Inventario de vehículo creado/actualizado.', type: CreateVehicleInventoryDto })
  @ApiResponse({ status: 400, description: 'Entrada inválida (ej. IDs no existen).' })
  @ApiResponse({ status: 409, description: 'Conflicto - Ya existe un inventario para este vehículo y producto (si se usa POST para crear y ya existe).' })
  createOrUpdateVehicleInventory(
    @Body() dto: CreateVehicleInventoryDto
  ) {
    return this.service.createOrUpdateVehicleInventory(dto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Listar todos los inventarios de vehiculos' })
  @ApiResponse({ status: 200, description: 'Lista de inventarios de vehículos.', type: [CreateVehicleInventoryDto] })
  getAllVehicleInventory() {
    return this.service.getAllVehicleInventory();
  }

  @Get(':vehicleId/:productId')
  @Auth(Role.ADMIN, Role.USER)
  @ApiParam({ name: 'vehicleId', type: 'integer', description: 'ID del Vehículo' })
  @ApiParam({ name: 'productId', type: 'integer', description: 'ID del Producto' })
  @ApiOperation({ summary: 'Obtener un inventario específico por ID de vehículo y producto' })
  @ApiResponse({ status: 200, description: 'Inventario encontrado.', type: CreateVehicleInventoryDto })
  @ApiResponse({ status: 404, description: 'Inventario no encontrado.' })
  getVehicleInventoryById(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.service.getVehicleInventoryById(vehicleId, productId);
  }

  @Patch(':vehicleId/:productId')
  @Auth(Role.ADMIN)
  @ApiParam({ name: 'vehicleId', type: 'integer', description: 'ID del Vehículo' })
  @ApiParam({ name: 'productId', type: 'integer', description: 'ID del Producto' })
  @ApiOperation({ summary: 'Actualizar cantidades en un inventario de vehículo' })
  @ApiResponse({ status: 200, description: 'Inventario actualizado.', type: UpdateVehicleInventoryDto })
  @ApiResponse({ status: 404, description: 'Inventario no encontrado.' })
  updateVehicleInventoryQuantities(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateVehicleInventoryDto,
  ) {
    return this.service.updateVehicleInventoryQuantities(vehicleId, productId, dto);
  }

  @Delete(':vehicleId/:productId')
  @Auth(Role.ADMIN)
  @ApiParam({ name: 'vehicleId', type: 'integer', description: 'ID del Vehículo' })
  @ApiParam({ name: 'productId', type: 'integer', description: 'ID del Producto' })
  @ApiOperation({ summary: 'Eliminar un registro de inventario de vehículo' })
  @ApiResponse({ status: 200, description: 'Inventario eliminado.' })
  @ApiResponse({ status: 404, description: 'Inventario no encontrado.' })
  deleteVehicleInventoryById(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.service.deleteVehicleInventoryById(vehicleId, productId);
  }
}
