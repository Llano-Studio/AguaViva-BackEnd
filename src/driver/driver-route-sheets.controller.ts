import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DriverRouteSheetsService } from './driver-route-sheets.service';
import {
  DriverRouteSheetDetailDto,
  DriverRouteSheetSummaryDto,
  FilterDriverRouteSheetsDto,
  PauseRouteSheetDto,
} from './dto';

@ApiTags('🚚 Chofer - Hojas de Ruta')
@ApiBearerAuth()
@Auth(Role.DRIVERS)
@Controller('driver/route-sheets')
export class DriverRouteSheetsController {
  constructor(private readonly driverRouteSheetsService: DriverRouteSheetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Hojas de ruta del chofer autenticado',
    description:
      'Lista las hojas de ruta asignadas al chofer para una fecha (por defecto, hoy). Para hoy también incluye hojas de días anteriores que quedaron en curso o pausadas.',
  })
  @ApiResponse({ status: 200, type: [DriverRouteSheetSummaryDto] })
  findAll(
    @GetUser() user: User,
    @Query() filters: FilterDriverRouteSheetsDto,
  ): Promise<DriverRouteSheetSummaryDto[]> {
    return this.driverRouteSheetsService.findForDriver(user.id, filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de una hoja de ruta con sus entregas en orden',
    description:
      'Devuelve las entregas en el orden del recorrido. Con la hoja en curso, solo la primera entrega sin resolver queda habilitada (is_current); las siguientes quedan bloqueadas (is_locked).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: DriverRouteSheetDetailDto })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  findOne(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverRouteSheetDetailDto> {
    return this.driverRouteSheetsService.findOneForDriver(user.id, id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar el recorrido',
    description:
      'Pasa la hoja de PLANNED a IN_PROGRESS. El chofer no puede tener otra hoja en curso.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: DriverRouteSheetDetailDto })
  @ApiResponse({ status: 409, description: 'Estado inválido u otra hoja en curso' })
  start(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverRouteSheetDetailDto> {
    return this.driverRouteSheetsService.start(user.id, id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pausar el recorrido',
    description:
      'Pasa la hoja de IN_PROGRESS a PAUSED y registra el motivo (desperfecto, reabastecimiento u otro).',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: DriverRouteSheetDetailDto })
  @ApiResponse({ status: 409, description: 'La hoja no está en curso' })
  pause(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PauseRouteSheetDto,
  ): Promise<DriverRouteSheetDetailDto> {
    return this.driverRouteSheetsService.pause(user.id, id, dto);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reanudar el recorrido',
    description: 'Pasa la hoja de PAUSED a IN_PROGRESS y cierra la pausa abierta.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, type: DriverRouteSheetDetailDto })
  @ApiResponse({ status: 409, description: 'La hoja no está pausada u otra hoja en curso' })
  resume(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DriverRouteSheetDetailDto> {
    return this.driverRouteSheetsService.resume(user.id, id);
  }
}
