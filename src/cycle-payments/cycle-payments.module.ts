import { Module } from '@nestjs/common';
import { CyclePaymentsService } from './cycle-payments.service';
import { CyclePaymentsController } from './cycle-payments.controller';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuthModule, CommonModule, AuditModule],
  controllers: [CyclePaymentsController],
  providers: [CyclePaymentsService],
  exports: [CyclePaymentsService],
})
export class CyclePaymentsModule {}
