import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OneOffPurchaseService } from './one-off-purchase.service';
import { SubscriptionQuotaService } from './services/subscription-quota.service';
import { CancellationOrderService } from './cancellation-order.service';
import { CancellationOrderReassignmentService } from './services/cancellation-order-reassignment.service';
import { AutomatedCollectionService } from './services/automated-collection.service';
import { OrderCollectionEditService } from './services/order-collection-edit.service';
import { ManualCollectionService } from './services/manual-collection.service';
import { FirstCycleComodatoService } from './services/first-cycle-comodato.service';
import { OverdueOrderService } from './services/overdue-order.service';
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

@Module({
  imports: [InventoryModule, CommonModule],
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
  providers: [
    OrdersService,
    OneOffPurchaseService,
    SubscriptionQuotaService,
    CancellationOrderService,
    CancellationOrderReassignmentService,
    AutomatedCollectionService,
    OrderCollectionEditService,
    ManualCollectionService,
    FirstCycleComodatoService,
    OverdueOrderService,
  ],
  exports: [
    OrdersService,
    OneOffPurchaseService,
    SubscriptionQuotaService,
    CancellationOrderService,
    CancellationOrderReassignmentService,
    AutomatedCollectionService,
    OrderCollectionEditService,
    ManualCollectionService,
    FirstCycleComodatoService,
    OverdueOrderService,
  ],
})
export class OrdersModule {}
