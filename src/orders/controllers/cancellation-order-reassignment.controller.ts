import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Auth } from '../../auth/decorators/auth.decorator';
import { CancellationOrderReassignmentService } from '../../common/services/cancellation-order-reassignment.service';

@ApiTags('Reasignación de Órdenes de Cancelación')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE, Role.SUPERADMIN)
@Controller('cancellation-order-reassignment')
export class CancellationOrderReassignmentController {
  constructor(
    private readonly cancellationOrderReassignmentService: CancellationOrderReassignmentService,
  ) {}

  @Post('reassign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ejecutar reasignación manual de órdenes de cancelación',
    description:
      'Ejecuta manualmente el proceso de reasignación de órdenes de cancelación fallidas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Proceso de reasignación ejecutado exitosamente',
  })
  async forceReassignmentCheck() {
    await this.cancellationOrderReassignmentService.forceReassignmentCheck();
    return {
      message: 'Reasignación de órdenes de cancelación ejecutada exitosamente',
    };
  }
}
