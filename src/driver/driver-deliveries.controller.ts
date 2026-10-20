import {
  Body,
  Controller,
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
import { DriverRouteSheetsService } from './driver-route-sheets.service';
import { AddDeliveryItemsDto, DriverDeliveryDetailDto } from './dto';

@ApiTags('🚚 Chofer - Entregas')
@ApiBearerAuth()
@Auth(Role.DRIVERS)
@Controller('driver/deliveries')
export class DriverDeliveriesController {
  constructor(private readonly driverRouteSheetsService: DriverRouteSheetsService) {}

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
    return this.driverRouteSheetsService.addItemsToDelivery(user.id, detailId, dto);
  }
}
