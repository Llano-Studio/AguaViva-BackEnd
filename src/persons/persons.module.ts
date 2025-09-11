import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { TestComodatosController } from './test-comodatos.controller';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { CustomerSubscriptionModule } from '../customer-subscription/customer-subscription.module';
import { OrdersModule } from '../orders/orders.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  controllers: [PersonsController, TestComodatosController],
  providers: [PersonsService],
  exports: [PersonsService],
  imports: [
    AuthModule,
    CommonModule,
    CustomerSubscriptionModule,
    OrdersModule,
    InventoryModule,
  ],
})
export class PersonsModule {}
