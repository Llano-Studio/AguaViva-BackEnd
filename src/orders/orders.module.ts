import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { CancellationOrderService } from './cancellation-order.service';
import { OrdersController } from './orders.controller';
import { OneOffPurchaseController } from './one-off-purchase.controller';
import { CancellationOrderController } from './cancellation-order.controller';
import { AutomatedCollectionController } from './controllers/automated-collection.controller';
import { OrderCollectionEditController } from './controllers/order-collection-edit.controller';
import { ManualCollectionController } from './controllers/manual-collection.controller';
import { FirstCycleComodatoController } from './controllers/first-cycle-comodato.controller';
import { OverdueOrderController } from './controllers/overdue-order.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { CommonModule } from '../common/common.module';
import { ServicesModule } from '../common/services/services.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [InventoryModule, CommonModule, ServicesModule, AuditModule],
  controllers: [
    OrdersController,
    OneOffPurchaseController,
    CancellationOrderController,
    AutomatedCollectionController,
    OrderCollectionEditController,
    ManualCollectionController,
    FirstCycleComodatoController,
    OverdueOrderController,
  ],
  providers: [OrdersService, OneOffPurchaseService, CancellationOrderService],
  exports: [OrdersService, OneOffPurchaseService, CancellationOrderService],
})
export class OrdersModule {}
