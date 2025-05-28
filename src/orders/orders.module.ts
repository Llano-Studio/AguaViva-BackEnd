import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService, OneOffPurchaseService],
  exports: [OrdersService]
})
export class OrdersModule {}
