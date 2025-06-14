import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ScheduleService } from '../common/services/schedule.service';

@Module({
  imports: [InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService, OneOffPurchaseService, ScheduleService],
  exports: [OrdersService]
})
export class OrdersModule {}
