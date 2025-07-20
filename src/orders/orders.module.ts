import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { MultiOneOffPurchaseService } from './multi-one-off-purchase.service';
import { OrdersController } from './orders.controller';
import { MultiOneOffPurchaseController } from './multi-one-off-purchase.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [InventoryModule, CommonModule],
  controllers: [OrdersController, MultiOneOffPurchaseController],
  providers: [OrdersService, OneOffPurchaseService, MultiOneOffPurchaseService],
  exports: [OrdersService, OneOffPurchaseService, MultiOneOffPurchaseService]
})
export class OrdersModule {}
