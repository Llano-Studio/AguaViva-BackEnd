import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { ClientPortalJwtGuard } from './guards/client-portal-jwt.guard';
import { GetClientPortal } from './decorators/get-client-portal.decorator';
import { ClientPortalPayload } from './guards/client-portal-jwt.guard';
import { PortalCreateOrderDto } from './dto/portal-create-order.dto';
import { PortalUpdateOrderDto } from './dto/portal-update-order.dto';
import { PortalFilterOrdersDto } from './dto/portal-filter-orders.dto';
import {
  PortalChangePasswordDto,
  PortalProfileResponseDto,
  PortalUpdateProfileDto,
} from './dto/portal-profile.dto';
import { OrderResponseDto } from '../orders/dto/order-response.dto';

@ApiTags('Portal Clientes')
@ApiBearerAuth()
@UseGuards(ClientPortalJwtGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obtener perfil del cliente autenticado' })
  @ApiResponse({ status: 200, type: PortalProfileResponseDto })
  me(@GetClientPortal() payload: ClientPortalPayload) {
    return this.portalService.getProfile(payload.customerId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Actualizar perfil del cliente autenticado' })
  @ApiResponse({ status: 200, type: PortalProfileResponseDto })
  updateMe(
    @GetClientPortal() payload: ClientPortalPayload,
    @Body(ValidationPipe) dto: PortalUpdateProfileDto,
  ) {
    return this.portalService.updateProfile(payload.customerId, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar contraseña del cliente autenticado' })
  async changePassword(
    @GetClientPortal() payload: ClientPortalPayload,
    @Body(ValidationPipe) dto: PortalChangePasswordDto,
  ) {
    return this.portalService.changePassword(payload.customerId, dto);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Crear pedido para el cliente autenticado' })
  @ApiResponse({ status: 201, type: OrderResponseDto })
  async createOrder(
    @GetClientPortal() payload: ClientPortalPayload,
    @Body(ValidationPipe) dto: PortalCreateOrderDto,
  ) {
    return this.portalService.createOrder(payload.customerId, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Historial de pedidos del cliente autenticado' })
  async getOrderHistory(
    @GetClientPortal() payload: ClientPortalPayload,
    @Query(new ValidationPipe({ transform: true })) filters: PortalFilterOrdersDto,
  ) {
    return this.portalService.getOrderHistory(payload.customerId, filters);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Detalle de un pedido del cliente autenticado' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  async getOrderById(
    @GetClientPortal() payload: ClientPortalPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.portalService.getOrderById(payload.customerId, id);
  }

  @Patch('orders/:id')
  @ApiOperation({ summary: 'Editar un pedido (solo PENDING)' })
  @ApiResponse({ status: 200, type: OrderResponseDto })
  async updateOrder(
    @GetClientPortal() payload: ClientPortalPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: PortalUpdateOrderDto,
  ) {
    return this.portalService.updateOrder(payload.customerId, id, dto);
  }

  @Delete('orders/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar un pedido (solo PENDING)' })
  async removeOrder(
    @GetClientPortal() payload: ClientPortalPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.portalService.removeOrder(payload.customerId, id);
  }
}
