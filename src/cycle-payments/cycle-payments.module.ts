import { Module } from '@nestjs/common';
import { CyclePaymentsService } from './cycle-payments.service';
import { CyclePaymentsController } from './cycle-payments.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CyclePaymentsController],
  providers: [CyclePaymentsService],
  exports: [CyclePaymentsService],
})
export class CyclePaymentsModule {}
