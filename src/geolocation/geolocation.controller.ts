import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { GeolocationService } from './geolocation.service';
import {
  PendingLocationsQueryDto,
  PendingLocationsResponseDto,
  PersonLocationDto,
  SetPersonLocationDto,
} from './dto/geolocation.dto';

@ApiTags('👥 Clientes - Ubicación')
@Controller('persons')
export class GeolocationController {
  constructor(private readonly geolocation: GeolocationService) {}

  @Get('locations/pending')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Clientes sin ubicación o con ubicación aproximada',
    description:
      'Listado para revisar en el mapa: clientes activos sin coordenadas (MISSING) o con un punto aproximado (APPROXIMATE). Trae además la cobertura total.',
  })
  @ApiResponse({ status: 200, type: PendingLocationsResponseDto })
  listPending(
    @Query() query: PendingLocationsQueryDto,
  ): Promise<PendingLocationsResponseDto> {
    return this.geolocation.listPending(query);
  }

  @Patch(':id/location')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Marcar la ubicación del cliente',
    description:
      'Guarda el punto marcado en el mapa (origen ADMIN, precisión EXACT). Es el dato que más manda: ni la geocodificación ni el GPS del chofer lo pisan.',
  })
  @ApiResponse({ status: 200, type: PersonLocationDto })
  @ApiResponse({
    status: 400,
    description: 'El punto está fuera de la zona de operación',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  setLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetPersonLocationDto,
  ): Promise<PersonLocationDto> {
    return this.geolocation.setManualLocation(id, dto);
  }
}
