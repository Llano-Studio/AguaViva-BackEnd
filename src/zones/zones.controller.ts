import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@Auth(Role.ADMIN) 
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  async createZone(
    @Body() createZoneDto: CreateZoneDto
  ) {
    return this.zonesService.createZone(createZoneDto);
  }

  @Get()
  async getAllZones() {
    return this.zonesService.getAllZones();
  }

  @Get(':id')
  async getZoneById(
    @Param('id') id: string
  ) {
    return this.zonesService.getZoneById(+id);
  }

  @Patch(':id')
  async updateZoneById(
    @Param('id') id: string, 
    @Body() updateZoneDto: UpdateZoneDto
  ) {
    return this.zonesService.updateZoneById(+id, updateZoneDto);
  }

  @Delete(':id')
  deleteZoneById(
    @Param('id') id: string
  ) {
    return this.zonesService.deleteZoneById(+id);
  }
}
