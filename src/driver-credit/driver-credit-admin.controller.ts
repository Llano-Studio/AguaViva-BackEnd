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
import { DriverCreditService } from './driver-credit.service';
import {
  ApplyDriverCreditInterestResultDto,
  DriverCreditListDto,
  DriverCreditPaymentResultDto,
  FilterDriverCreditsDto,
  RegisterDriverCreditPaymentDto,
} from './dto/driver-credit.dto';

@ApiTags('💰 Administración - Cuenta corriente de choferes')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
@Controller('driver-credits')
export class DriverCreditAdminController {
  constructor(private readonly driverCreditService: DriverCreditService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar deudas de clientes tomadas por choferes',
    description:
      'Cargos de la cuenta corriente de choferes con su vencimiento, interés y saldo. Filtra por chofer, cliente y estado (OPEN, OVERDUE, SETTLED). Aplica antes el interés vencido.',
  })
  @ApiResponse({ status: 200, type: DriverCreditListDto })
  findAll(
    @Query() filters: FilterDriverCreditsDto,
  ): Promise<DriverCreditListDto> {
    return this.driverCreditService.listCharges(filters);
  }

  @Post('drivers/:driverId/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Registrar un pago del chofer',
    description:
      'Imputa el pago a los cargos abiertos del chofer, del más viejo al más nuevo o en el orden de `charge_ids`. Idempotente por `idempotency_key`.',
  })
  @ApiParam({ name: 'driverId', type: Number })
  @ApiResponse({ status: 200, type: DriverCreditPaymentResultDto })
  @ApiResponse({
    status: 409,
    description: 'Supera la deuda o cargos inválidos',
  })
  registerPayment(
    @GetUser() user: User,
    @Param('driverId', ParseIntPipe) driverId: number,
    @Body() dto: RegisterDriverCreditPaymentDto,
  ): Promise<DriverCreditPaymentResultDto> {
    return this.driverCreditService.registerPayment(user.id, driverId, dto);
  }

  @Post('apply-interest')
  @HttpCode(HttpStatus.OK)
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Aplicar el interés por mora vencido',
    description:
      'Aplica una sola vez el interés a cada cargo vencido e impago. Pensado para el cron diario; es idempotente.',
  })
  @ApiResponse({ status: 200, type: ApplyDriverCreditInterestResultDto })
  applyInterest(): Promise<ApplyDriverCreditInterestResultDto> {
    return this.driverCreditService.applyDueInterest();
  }
}
