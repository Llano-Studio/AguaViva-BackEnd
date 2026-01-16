import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../../auth/decorators/auth.decorator';
import { FailedOrderReassignmentService } from '../../common/services/failed-order-reassignment.service';

@ApiTags('Reasignación de Pedidos Fallidos')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.SUPERADMIN)
@Controller('failed-order-reassignment')
export class FailedOrderReassignmentController {
  constructor(
    private readonly failedOrderReassignmentService: FailedOrderReassignmentService,
  ) {}

  @Post('reassign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar reasignación manual de pedidos fallidos',
    description:
      'Ejecuta manualmente el proceso de reasignación de pedidos marcados como fallidos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proceso de reasignación ejecutado exitosamente',
  })
  async forceReassignmentCheck() {
    await this.failedOrderReassignmentService.forceReassignmentCheck();
    return {
      message: 'Reasignación de pedidos fallidos ejecutada exitosamente',
    };
  }
}
