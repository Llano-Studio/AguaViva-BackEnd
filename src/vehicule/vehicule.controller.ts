import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CreateVehicleDto } from './dto/create-vehicule.dto';
import { UpdateVehicleDto } from './dto/update-vehicule.dto';
import { VehicleService } from './vehicule.service';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Auth(Role.ADMIN, Role.USER)
@Controller('vehicule')
export class VehiculeController {

  constructor(
    private readonly vehiculeService: VehicleService
  ) { }

  @Post()
  createVehicule(
    @Body() createVehiculeDto: CreateVehicleDto
  ) {
    return this.vehiculeService.createVehicule(createVehiculeDto);
  }

  @Get()
  getAllVehicules(
     @Query('code') code?: string,
  ) {
    if(code) return this.vehiculeService.getVehiculeByCode(code);
    return this.vehiculeService.getAllVehicules();
  }

  @Get(':id')
  getVehiculeById(
    @Param('id') id: string
  ) {
    return this.vehiculeService.getVehiculeById(+id);
  }

  @Patch(':id')
  updateVehiculeById(
    @Param('id') id: string,
    @Body() updateVehiculeDto: UpdateVehicleDto
  ) {
    return this.vehiculeService.updateVehiculeById(+id, updateVehiculeDto);
  }

  @Delete(':id')
  deleteVehiculeById(
    @Param('id') id: string
  ) {
    return this.vehiculeService.deleteVehiculeById(+id);
  }
}
