import { Module } from '@nestjs/common';
import { CustomerSubscriptionService } from './customer-subscription.service';
import { CustomerSubscriptionController } from './customer-subscription.controller';
import { CommonModule } from '../common/common.module';
import { OrdersModule } from '../orders/orders.module';
import { MultipleSubscriptionsModule } from './multiple-subscriptions.module';

@Module({
  imports: [CommonModule, OrdersModule, MultipleSubscriptionsModule],
  controllers: [CustomerSubscriptionController],
  providers: [CustomerSubscriptionService],
  exports: [CustomerSubscriptionService, MultipleSubscriptionsModule],
})
export class CustomerSubscriptionModule {}
