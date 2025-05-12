import {
  Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth,
} from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Zonas')
@ApiBearerAuth()
@Auth(Role.ADMIN)
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una zona' })
  @ApiResponse({ status: 201, description: 'Zona creada', type: CreateZoneDto })
  @ApiResponse({ status: 409, description: 'Conflicto - El código de la zona ya existe.' })
  createZone(
    @Body() dto: CreateZoneDto
  ) {
    return this.zonesService.createZone(dto);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Listar todas las zonas' })
  @ApiResponse({ status: 200, description: 'Listado de zonas', type: [CreateZoneDto] })
  getAllZones() {
    return this.zonesService.getAllZones();
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: Number, description: 'ID de la Zona' })
  @ApiOperation({ summary: 'Obtener zona por ID' })
  @ApiResponse({ status: 200, description: 'Datos de la zona', type: CreateZoneDto })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  getZoneById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.zonesService.getZoneById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: Number, description: 'ID de la Zona' })
  @ApiOperation({ summary: 'Actualizar zona' })
  @ApiResponse({ status: 200, description: 'Zona actualizada', type: CreateZoneDto })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código de la zona ya está en uso.' })
  updateZoneById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.zonesService.updateZoneById(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: Number, description: 'ID de la Zona' })
  @ApiOperation({ summary: 'Eliminar zona' })
  @ApiResponse({ status: 200, description: 'Zona eliminada' })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto - La zona está en uso y no puede ser eliminada.' })
  deleteZoneById(@Param('id', ParseIntPipe) id: number) {
    return this.zonesService.deleteZoneById(id);
  }
}
