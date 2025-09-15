import { Module } from '@nestjs/common';
import { CyclePaymentsService } from './cycle-payments.service';
import { CyclePaymentsController } from './cycle-payments.controller';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [AuthModule, CommonModule],
  controllers: [CyclePaymentsController],
  providers: [CyclePaymentsService],
  exports: [CyclePaymentsService],
})
export class CyclePaymentsModule {}
