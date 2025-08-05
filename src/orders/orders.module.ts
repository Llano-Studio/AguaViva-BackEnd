import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { SubscriptionQuotaService } from './services/subscription-quota.service';
import { OrdersController } from './orders.controller';
import { OneOffPurchaseController } from './one-off-purchase.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [InventoryModule, CommonModule],
  controllers: [OrdersController, OneOffPurchaseController],
  providers: [OrdersService, OneOffPurchaseService, SubscriptionQuotaService],
  exports: [OrdersService, OneOffPurchaseService, SubscriptionQuotaService]
})
export class OrdersModule {}
