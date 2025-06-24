import { Module } from '@nestjs/common';
import { CustomerSubscriptionService } from './customer-subscription.service';
import { CustomerSubscriptionController } from './customer-subscription.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [CustomerSubscriptionController],
  providers: [CustomerSubscriptionService],
  exports: [CustomerSubscriptionService],
})
export class CustomerSubscriptionModule {} 