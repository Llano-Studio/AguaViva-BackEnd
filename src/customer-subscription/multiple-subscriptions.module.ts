import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MultipleSubscriptionsService } from './services/multiple-subscriptions.service';
import { MultipleSubscriptionsController } from './controllers/multiple-subscriptions.controller';
import { CyclePaymentsModule } from '../cycle-payments/cycle-payments.module';

@Module({
  imports: [
    AuthModule,
    CyclePaymentsModule
  ],
  controllers: [MultipleSubscriptionsController],
  providers: [MultipleSubscriptionsService],
  exports: [MultipleSubscriptionsService]
})
export class MultipleSubscriptionsModule {}