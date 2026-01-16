import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../../auth/decorators/auth.decorator';
import { SubscriptionCycleRenewalService } from '../../common/services/subscription-cycle-renewal.service';

@ApiTags('Renovación de Ciclos de Suscripción')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.SUPERADMIN)
@Controller('subscription-cycle-renewal')
export class SubscriptionCycleRenewalController {
  constructor(
    private readonly subscriptionCycleRenewalService: SubscriptionCycleRenewalService,
  ) {}

  @Post('renew')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar renovación manual de ciclos',
    description:
      'Ejecuta manualmente el proceso de renovación de ciclos expirados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proceso de renovación ejecutado exitosamente',
  })
  async forceRenewalCheck() {
    await this.subscriptionCycleRenewalService.forceRenewalCheck();
    return { message: 'Renovación de ciclos ejecutada exitosamente' };
  }

  @Post('check-late-fees')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar verificación manual de recargos',
    description:
      'Ejecuta manualmente el proceso de verificación y aplicación de recargos por mora.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proceso de verificación de recargos ejecutado exitosamente',
  })
  async forceLateFeeCheck() {
    await this.subscriptionCycleRenewalService.forceLateFeeCheck();
    return { message: 'Verificación de recargos ejecutada exitosamente' };
  }
}
