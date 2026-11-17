import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DriverCreditService } from './driver-credit.service';
import {
  DriverCreditListDto,
  FilterDriverCreditsDto,
} from './dto/driver-credit.dto';

@ApiTags('🚚 Chofer - Rendición')
@ApiBearerAuth()
@Auth(Role.DRIVERS)
@Controller('driver/me/credits')
export class DriverCreditDriverController {
  constructor(private readonly driverCreditService: DriverCreditService) {}

  @Get()
  @ApiOperation({
    summary: 'Deudas de clientes en mi cuenta corriente',
    description:
      'Cargos que el chofer tomó al dejar pagar con su cuenta corriente, con vencimiento, interés y saldo.',
  })
  @ApiResponse({ status: 200, type: DriverCreditListDto })
  findMine(
    @GetUser() user: User,
    @Query() filters: FilterDriverCreditsDto,
  ): Promise<DriverCreditListDto> {
    return this.driverCreditService.listCharges({
      ...filters,
      driver_id: user.id,
    });
  }
}
