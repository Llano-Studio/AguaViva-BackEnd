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
import { RouteReconciliationService } from './route-reconciliation.service';
import {
  ConfirmRouteReconciliationDto,
  DriverAccountDto,
  FilterDriverAccountDto,
  RouteReconciliationDto,
  RouteReconciliationPreviewDto,
} from './dto';

@ApiTags('🚚 Chofer - Rendición')
@ApiBearerAuth()
@Auth(Role.DRIVERS)
@Controller('driver')
export class DriverReconciliationController {
  constructor(
    private readonly routeReconciliationService: RouteReconciliationService,
  ) {}

  @Get('route-sheets/:id/reconciliation')
  @ApiOperation({
    summary: 'Previsualizar la rendición de la hoja de ruta',
    description:
      'Devuelve los cobros consolidados por método, el efectivo a rendir y el resumen por producto (cargado, entregado, devuelto). Incluye la versión que debe enviarse al confirmar. No cierra la hoja.',
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta', type: Number })
  @ApiResponse({ status: 200, type: RouteReconciliationPreviewDto })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  preview(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RouteReconciliationPreviewDto> {
    return this.routeReconciliationService.previewForDriver(user.id, id);
  }

  @Post('route-sheets/:id/reconciliation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar la rendición y cerrar la hoja de ruta',
    description:
      'Registra la rendición con su snapshot auditable y cierra la hoja. Exige que no queden paradas sin resolver y que la versión enviada siga vigente. Es idempotente por idempotency_key: reintentar con la misma clave devuelve la rendición ya registrada. El efectivo cobrado queda como deuda del chofer hasta que se reciba.',
  })
  @ApiParam({ name: 'id', description: 'ID de la hoja de ruta', type: Number })
  @ApiResponse({ status: 200, type: RouteReconciliationDto })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  @ApiResponse({
    status: 409,
    description:
      'Paradas pendientes, versión obsoleta, hoja fuera de curso o ya rendida',
  })
  confirm(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmRouteReconciliationDto,
  ): Promise<RouteReconciliationDto> {
    return this.routeReconciliationService.confirmByDriver(user.id, id, dto);
  }

  @Get('me/account')
  @ApiOperation({
    summary: 'Cuenta corriente del chofer',
    description:
      'Saldo reconstruido sumando los movimientos: positivo significa que el chofer debe a la empresa. Incluye los movimientos paginados.',
  })
  @ApiResponse({ status: 200, type: DriverAccountDto })
  getAccount(
    @GetUser() user: User,
    @Query() filters: FilterDriverAccountDto,
  ): Promise<DriverAccountDto> {
    return this.routeReconciliationService.getDriverAccount(user.id, filters);
  }
}
