import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { DriverQuantityEditService } from './driver-quantity-edit.service';
import {
  DriverDeliverySummaryDto,
  EnableQuantityEditDto,
  QuantityEditAuthorizationDto,
  UpdateDeliveryItemsDto,
} from './dto';

@ApiTags('💰 Administración - Edición de cantidades en ruta')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
@Controller('route-sheets/details/:detailId/quantity-edit')
export class QuantityEditAdminController {
  constructor(
    private readonly quantityEditService: DriverQuantityEditService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Habilitar al chofer a reducir cantidades de la parada',
    description:
      'Cuando el cliente recibe menos de lo pedido, el chofer se comunica con administración, que habilita la parada. La habilitación sirve para una sola edición. Si ya hay una vigente, la devuelve.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 201, type: QuantityEditAuthorizationDto })
  @ApiResponse({ status: 409, description: 'Parada resuelta o sin productos' })
  enable(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: EnableQuantityEditDto,
  ): Promise<QuantityEditAuthorizationDto> {
    return this.quantityEditService.enable(user.id, detailId, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Revocar la habilitación vigente' })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: QuantityEditAuthorizationDto })
  @ApiResponse({ status: 404, description: 'No hay habilitación vigente' })
  revoke(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
  ): Promise<QuantityEditAuthorizationDto> {
    return this.quantityEditService.revoke(user.id, detailId);
  }

  @Get()
  @ApiOperation({
    summary: 'Historial de habilitaciones de la parada',
    description: 'Incluye qué cantidades cambió el chofer en cada una.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: [QuantityEditAuthorizationDto] })
  history(
    @Param('detailId', ParseIntPipe) detailId: number,
  ): Promise<QuantityEditAuthorizationDto[]> {
    return this.quantityEditService.findForDetail(detailId);
  }
}

@ApiTags('🚚 Chofer - Entregas')
@ApiBearerAuth()
@Auth(Role.DRIVERS)
@Controller('driver/deliveries')
export class DriverQuantityEditController {
  constructor(
    private readonly quantityEditService: DriverQuantityEditService,
  ) {}

  @Patch(':detailId/items')
  @ApiOperation({
    summary: 'Reducir cantidades a entregar',
    description:
      'Requiere que administración haya habilitado la parada. Solo baja cantidades, antes de la firma. Ajusta el total del pedido y, en pedidos con abono, devuelve al ciclo lo que estaba cubierto por la cuota.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: DriverDeliverySummaryDto })
  @ApiResponse({ status: 400, description: 'Cantidades inválidas' })
  @ApiResponse({
    status: 409,
    description:
      'Sin habilitación, parada resuelta o firmada, o ya se cobró más que el nuevo total',
  })
  updateItems(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: UpdateDeliveryItemsDto,
  ): Promise<DriverDeliverySummaryDto> {
    return this.quantityEditService.applyByDriver(user.id, detailId, dto);
  }
}
