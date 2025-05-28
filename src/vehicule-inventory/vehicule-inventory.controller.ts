import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { VehicleInventoryService } from './vehicule-inventory.service';
import { UpdateVehicleInventoryDto, CreateVehicleInventoryDto, FilterVehicleInventoryDto } from './dto';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Inventario de vehículos')
@ApiBearerAuth()
@Controller('vehicle-inventories')
export class VehicleInventoryController {
  constructor(private readonly service: VehicleInventoryService) {}

  @Post()
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Crear o actualizar un registro de inventario de vehículo' })
  @ApiResponse({ status: 201, description: 'Inventario de vehículo creado/actualizado.' })
  createOrUpdateVehicleInventory(
    @Body(ValidationPipe) dto: CreateVehicleInventoryDto
  ) {
    return this.service.createOrUpdateVehicleInventory(dto);
  }

  @Get()
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Listar todos los inventarios de vehiculos' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de inventarios de vehículos.',
    // Schema idealmente un DTO paginado específico
  })
  getAllVehicleInventory(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, forbidNonWhitelisted: true })) 
    filterDto: FilterVehicleInventoryDto,
  ) {
    return this.service.getAllVehicleInventory(filterDto);
  }

  @Get(':vehicleId/:productId')
  @Auth(Role.ADMIN, Role.USER)
  @ApiParam({ name: 'vehicleId', type: 'integer', description: 'ID del Vehículo' })
  @ApiParam({ name: 'productId', type: 'integer', description: 'ID del Producto' })
  @ApiOperation({ summary: 'Obtener un inventario específico por ID de vehículo y producto' })
  @ApiResponse({ status: 200, description: 'Inventario encontrado.' })
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
  @ApiResponse({ status: 200, description: 'Inventario actualizado.' })
  updateVehicleInventoryQuantities(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body(ValidationPipe) dto: UpdateVehicleInventoryDto,
  ) {
    return this.service.updateVehicleInventoryQuantities(vehicleId, productId, dto);
  }

  @Delete(':vehicleId/:productId')
  @Auth(Role.ADMIN)
  @ApiParam({ name: 'vehicleId', type: 'integer', description: 'ID del Vehículo' })
  @ApiParam({ name: 'productId', type: 'integer', description: 'ID del Producto' })
  @ApiOperation({ summary: 'Eliminar un registro de inventario de vehículo' })
  @ApiResponse({ status: 200, description: 'Inventario eliminado.' })
  deleteVehicleInventoryById(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.service.deleteVehicleInventoryById(vehicleId, productId);
  }
}
