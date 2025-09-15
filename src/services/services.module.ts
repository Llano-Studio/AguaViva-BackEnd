import { Module, Global } from '@nestjs/common';
import { CycleNumberingService } from './cycle-numbering.service';
import { RecoveryOrderService } from './recovery-order.service';
import { PrismaClient } from '@prisma/client';

@Global()
@Module({
  providers: [
    CycleNumberingService,
    RecoveryOrderService,
    PrismaClient
  ],
  exports: [
    CycleNumberingService,
    RecoveryOrderService
  ]
})
export class ServicesModule {}