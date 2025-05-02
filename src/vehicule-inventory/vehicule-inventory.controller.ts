import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { VehicleInventoryService } from './vehicule-inventory.service';
import { UpdateVehicleInventoryDto } from './dto/update-vehicule-inventory.dto';
import { CreateVehicleInventoryDto } from './dto/create-vehicule-inventory.dto';
import { Role } from '@prisma/client';
import { Auth } from 'src/auth/decorators/auth.decorator';


@ApiTags('vehicle-inventories')
@Auth(Role.ADMIN, Role.USER)
@Controller('vehicle-inventories')
export class VehicleInventoryController {
  constructor(private readonly service: VehicleInventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Crear inventario de vehículo' })
  createVehicleInventory(
    @Body() dto: CreateVehicleInventoryDto
  ) {
    return this.service.createVehicleInventory(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los inventarios de vehiculos' })
  getAllVehicleInventory() {
    return this.service.getAllVehicleInventory();
  }

  @Get(':vehicleId/:productId')
  @ApiParam({ name: 'vehicleId', type: 'integer' })
  @ApiParam({ name: 'productId', type: 'integer' })
  @ApiOperation({ summary: 'Obtener un inventario específico' })
  getVehicleInventoryById(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.service.getVehicleInventoryById(vehicleId, productId);
  }

  @Patch(':vehicleId/:productId')
  @ApiParam({ name: 'vehicleId', type: 'integer' })
  @ApiParam({ name: 'productId', type: 'integer' })
  @ApiOperation({ summary: 'Actualizar inventario de vehículo' })
  updateVehicleInventoryById(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateVehicleInventoryDto,
  ) {
    return this.service.updateVehicleInventoryById(vehicleId, productId, dto);
  }

  @Delete(':vehicleId/:productId')
  @ApiParam({ name: 'vehicleId', type: 'integer' })
  @ApiParam({ name: 'productId', type: 'integer' })
  @ApiOperation({ summary: 'Eliminar inventario de vehículo' })
  deleteVehiculeInventoryById(
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.service.deleteVehiculeInventoryById(vehicleId, productId);
  }
}
