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
  FilterRouteReconciliationsDto,
  ReceiveCashDto,
  ReconciliationAdjustmentDto,
  RouteReconciliationDto,
  RouteReconciliationListDto,
} from './dto';

@ApiTags('💰 Administración - Rendiciones')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
@Controller('route-reconciliations')
export class RouteReconciliationAdminController {
  constructor(
    private readonly routeReconciliationService: RouteReconciliationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Listar rendiciones',
    description:
      'Listado paginado de rendiciones con filtros por chofer, estado y rango de fecha de confirmación.',
  })
  @ApiResponse({ status: 200, type: RouteReconciliationListDto })
  findAll(
    @Query() filters: FilterRouteReconciliationsDto,
  ): Promise<RouteReconciliationListDto> {
    return this.routeReconciliationService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de una rendición',
    description: 'Devuelve el snapshot auditable completo de la rendición.',
  })
  @ApiParam({ name: 'id', description: 'ID de la rendición', type: Number })
  @ApiResponse({ status: 200, type: RouteReconciliationDto })
  @ApiResponse({ status: 404, description: 'Rendición no encontrada' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<RouteReconciliationDto> {
    return this.routeReconciliationService.findById(id);
  }

  @Post(':id/receive-cash')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Recibir el efectivo rendido',
    description:
      'Registra la recepción del efectivo, baja la deuda del chofer y marca la rendición como cobrada cuando se completó el monto a rendir. Idempotente por idempotency_key.',
  })
  @ApiParam({ name: 'id', description: 'ID de la rendición', type: Number })
  @ApiResponse({ status: 200, type: RouteReconciliationDto })
  @ApiResponse({ status: 404, description: 'Rendición no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'El monto supera el efectivo pendiente de rendir',
  })
  receiveCash(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveCashDto,
  ): Promise<RouteReconciliationDto> {
    return this.routeReconciliationService.receiveCash(user.id, id, dto);
  }

  @Post(':id/adjustment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ajustar la cuenta del chofer',
    description:
      'Registra un ajuste con motivo auditado. El monto es firmado: positivo aumenta la deuda, negativo la reduce. Idempotente por idempotency_key.',
  })
  @ApiParam({ name: 'id', description: 'ID de la rendición', type: Number })
  @ApiResponse({ status: 200, type: RouteReconciliationDto })
  @ApiResponse({ status: 404, description: 'Rendición no encontrada' })
  adjustment(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReconciliationAdjustmentDto,
  ): Promise<RouteReconciliationDto> {
    return this.routeReconciliationService.registerAdjustment(user.id, id, dto);
  }
}
