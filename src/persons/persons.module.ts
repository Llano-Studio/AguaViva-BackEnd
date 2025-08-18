import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { CustomerSubscriptionModule } from '../customer-subscription/customer-subscription.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService],
  imports: [AuthModule, CommonModule, CustomerSubscriptionModule, OrdersModule],
})
export class PersonsModule {}
