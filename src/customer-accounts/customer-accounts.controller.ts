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
import { CustomerAccountsService } from './customer-accounts.service';
import {
  AccountAdjustmentResponseDto,
  CreateAccountAdjustmentDto,
  CustomerAccountQueryDto,
  CustomerAccountResponseDto,
  ImportOpeningBalancesDto,
  OpeningBalanceImportResultDto,
  VoidAccountAdjustmentDto,
} from './dto/customer-account.dto';

@ApiTags('💰 Cuenta corriente de clientes')
@ApiBearerAuth()
@Controller('customer-accounts')
export class CustomerAccountsController {
  constructor(
    private readonly customerAccountsService: CustomerAccountsService,
  ) {}

  @Post('opening-balances/import')
  @HttpCode(HttpStatus.OK)
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Importar saldos iniciales (deuda anterior al sistema)',
    description:
      'Recibe las filas del Excel ya convertidas a JSON. Por defecto corre en dry_run: valida y devuelve el reporte sin guardar. Es todo o nada: si una fila tiene error no se guarda ninguna. Cada cliente puede tener un solo saldo inicial activo.',
  })
  @ApiResponse({ status: 200, type: OpeningBalanceImportResultDto })
  @ApiResponse({
    status: 400,
    description: 'Filas con errores (sin dry_run): no se guardó nada',
  })
  importOpeningBalances(
    @Body() dto: ImportOpeningBalancesDto,
    @GetUser() user: User,
  ): Promise<OpeningBalanceImportResultDto> {
    return this.customerAccountsService.importOpeningBalances(dto, user.id);
  }

  @Post('adjustments/:adjustmentId/void')
  @HttpCode(HttpStatus.OK)
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Anular un ajuste o saldo inicial',
    description:
      'El ajuste no se borra: queda inactivo con el motivo y deja de sumar al saldo.',
  })
  @ApiParam({ name: 'adjustmentId', type: Number })
  @ApiResponse({ status: 200, type: AccountAdjustmentResponseDto })
  @ApiResponse({ status: 409, description: 'Ya estaba anulado' })
  voidAdjustment(
    @Param('adjustmentId', ParseIntPipe) adjustmentId: number,
    @Body() dto: VoidAccountAdjustmentDto,
    @GetUser() user: User,
  ): Promise<AccountAdjustmentResponseDto> {
    return this.customerAccountsService.voidAdjustment(
      adjustmentId,
      dto,
      user.id,
    );
  }

  @Get(':customerId')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.ADMINISTRATIVE)
  @ApiOperation({
    summary: 'Cuenta corriente de un cliente',
    description:
      'Saldo actual (positivo = debe, negativo = saldo a favor) y movimientos en orden cronológico con saldo acumulado. Con from/to devuelve el período con su saldo de apertura y cierre.',
  })
  @ApiParam({ name: 'customerId', type: Number })
  @ApiResponse({ status: 200, type: CustomerAccountResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente inexistente' })
  getAccount(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Query() query: CustomerAccountQueryDto,
  ): Promise<CustomerAccountResponseDto> {
    return this.customerAccountsService.getAccount(customerId, query);
  }

  @Post(':customerId/adjustments')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Registrar un ajuste manual',
    description:
      'DEBIT suma deuda; CREDIT la descuenta. Para corregir, anular y volver a cargar.',
  })
  @ApiParam({ name: 'customerId', type: Number })
  @ApiResponse({ status: 201, type: AccountAdjustmentResponseDto })
  createAdjustment(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Body() dto: CreateAccountAdjustmentDto,
    @GetUser() user: User,
  ): Promise<AccountAdjustmentResponseDto> {
    return this.customerAccountsService.createAdjustment(
      customerId,
      dto,
      user.id,
    );
  }
}
