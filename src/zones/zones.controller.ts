import {
  Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth,
} from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('zones')
@ApiBearerAuth()
@Auth(Role.ADMIN)
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una zona' })
  @ApiResponse({ status: 201, description: 'Zona creada', type: CreateZoneDto })
  createZone(
    @Body() dto: CreateZoneDto
  ) {
    return this.zonesService.createZone(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las zonas' })
  @ApiResponse({ status: 200, description: 'Listado de zonas', type: [CreateZoneDto] })
  getAllZones() {
    return this.zonesService.getAllZones();
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Obtener zona por ID' })
  @ApiResponse({ status: 200, description: 'Datos de la zona', type: CreateZoneDto })
  getZoneById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.zonesService.getZoneById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Actualizar zona' })
  @ApiResponse({ status: 200, description: 'Zona actualizada', type: CreateZoneDto })
  updateZoneById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.zonesService.updateZoneById(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Eliminar zona' })
  @ApiResponse({ status: 200, description: 'Zona eliminada' })
  deleteZoneById(@Param('id', ParseIntPipe) id: number) {
    return this.zonesService.deleteZoneById(id);
  }
}
