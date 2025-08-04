import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { MultiOneOffPurchaseService } from './multi-one-off-purchase.service';
import { SubscriptionQuotaService } from './services/subscription-quota.service';
import { OrdersController } from './orders.controller';
import { MultiOneOffPurchaseController } from './multi-one-off-purchase.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [InventoryModule, CommonModule],
  controllers: [OrdersController, MultiOneOffPurchaseController],
  providers: [OrdersService, MultiOneOffPurchaseService, SubscriptionQuotaService],
  exports: [OrdersService, MultiOneOffPurchaseService, SubscriptionQuotaService]
})
export class OrdersModule {}
