import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { DriverDeliveriesService } from './driver-deliveries.service';
import { DriverRouteSheetsService } from './driver-route-sheets.service';
import {
  AddDeliveryItemsDto,
  ConfirmDeliveryDto,
  DriverDeliveryConfirmationResultDto,
  DriverDeliveryDetailDto,
  DriverDeliverySignatureResultDto,
  DriverDeliverySummaryDto,
  RegisterDeliverySignatureDto,
} from './dto';

@ApiTags('🚚 Chofer - Entregas')
@ApiBearerAuth()
@Auth(Role.DRIVERS)
@Controller('driver/deliveries')
export class DriverDeliveriesController {
  constructor(
    private readonly driverRouteSheetsService: DriverRouteSheetsService,
    private readonly driverDeliveriesService: DriverDeliveriesService,
  ) {}

  @Get(':detailId/summary')
  @ApiOperation({
    summary: 'Resumen de la parada para firmar',
    description:
      'Productos, cantidades, cobros ya registrados y saldo pendiente, con la version del estado. El cliente revisa este resumen antes de firmar. No permite operar una parada que no sea la actual.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: DriverDeliverySummaryDto })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  getSummary(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
  ): Promise<DriverDeliverySummaryDto> {
    return this.driverDeliveriesService.getSummary(user.id, detailId);
  }

  @Post(':detailId/signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar la firma del receptor',
    description:
      'Guarda la firma manuscrita enviada como data URI base64 y la vincula a la parada. Registrar una evidencia no marca la entrega como entregada: eso ocurre recién al confirmar.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: DriverDeliverySignatureResultDto })
  @ApiResponse({
    status: 400,
    description: 'Firma inválida o demasiado grande',
  })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  @ApiResponse({
    status: 409,
    description:
      'Parada resuelta, hoja fuera de curso o resumen desactualizado',
  })
  registerSignature(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: RegisterDeliverySignatureDto,
  ): Promise<DriverDeliverySignatureResultDto> {
    return this.driverDeliveriesService.registerSignature(
      user.id,
      detailId,
      dto,
    );
  }

  @Post(':detailId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar la entrega',
    description:
      'En una sola transacción valida el resumen firmado y la firma (o el motivo autorizado), descuenta el stock del camión, marca la parada y el pedido asociado como entregados. Un reintento sobre una entrega ya confirmada no vuelve a aplicar efectos.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: DriverDeliveryConfirmationResultDto })
  @ApiResponse({
    status: 409,
    description: 'Falta firma, resumen desactualizado o parada no operable',
  })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  confirmDelivery(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: ConfirmDeliveryDto,
  ): Promise<DriverDeliveryConfirmationResultDto> {
    return this.driverDeliveriesService.confirmDelivery(user.id, detailId, dto);
  }

  @Post(':detailId/items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Agregar productos a la parada actual',
    description:
      'Amplía la parada actual con productos que el cliente pide en el momento. El chofer solo envía producto y cantidad: el precio sale del catálogo del servidor y se valida contra el stock del camión. Se rechaza una parada resuelta, una hoja fuera de curso o un pedido ya cobrado.',
  })
  @ApiParam({ name: 'detailId', type: Number })
  @ApiResponse({ status: 200, type: DriverDeliveryDetailDto })
  @ApiResponse({ status: 404, description: 'No existe o no es del chofer' })
  @ApiResponse({
    status: 409,
    description: 'Parada resuelta, hoja fuera de curso o falta de stock',
  })
  addItems(
    @GetUser() user: User,
    @Param('detailId', ParseIntPipe) detailId: number,
    @Body() dto: AddDeliveryItemsDto,
  ): Promise<DriverDeliveryDetailDto> {
    return this.driverRouteSheetsService.addItemsToDelivery(
      user.id,
      detailId,
      dto,
    );
  }
}
