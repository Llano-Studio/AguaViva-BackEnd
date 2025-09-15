import { Module } from '@nestjs/common';
import { CustomerSubscriptionService } from './customer-subscription.service';
import { CustomerSubscriptionController } from './customer-subscription.controller';
import { CycleNumberingService } from './services/cycle-numbering.service';
import { SubscriptionCycleCalculatorService } from './services/subscription-cycle-calculator.service';
import { CommonModule } from '../common/common.module';
import { OrdersModule } from '../orders/orders.module';
import { MultipleSubscriptionsModule } from './multiple-subscriptions.module';

@Module({
  imports: [CommonModule, OrdersModule, MultipleSubscriptionsModule],
  controllers: [CustomerSubscriptionController],
  providers: [CustomerSubscriptionService, CycleNumberingService, SubscriptionCycleCalculatorService],
  exports: [CustomerSubscriptionService, MultipleSubscriptionsModule, SubscriptionCycleCalculatorService],
})
export class CustomerSubscriptionModule {}
