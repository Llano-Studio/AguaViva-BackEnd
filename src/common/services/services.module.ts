import { Module, Global } from '@nestjs/common';
import { GeneralCycleNumberingService } from './general-cycle-numbering.service';
import { RecoveryOrderService } from './recovery-order.service';
import { AutomatedCollectionService } from './automated-collection.service';
import { TempFileManagerService } from './temp-file-manager.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { RouteSheetGeneratorService } from './route-sheet-generator.service';
import { CancellationOrderReassignmentService } from './cancellation-order-reassignment.service';
import { DeliveryEvidenceService } from './delivery-evidence.service';
import { FirstCycleComodatoService } from './first-cycle-comodato.service';
import { IncidentService } from './incident.service';
import { ManualCollectionService } from './manual-collection.service';
import { MobileInventoryService } from './mobile-inventory.service';
import { MultipleSubscriptionsService } from './multiple-subscriptions.service';
import { OrderCollectionEditService } from './order-collection-edit.service';
import { OverdueOrderService } from './overdue-order.service';
import { RouteOptimizationService } from './route-optimization.service';
import { SubscriptionCycleCalculatorService } from './subscription-cycle-calculator.service';
import { SubscriptionCycleNumberingService } from './subscription-cycle-numbering.service';
import { SubscriptionQuotaService } from './subscription-quota.service';

import { OrdersService } from '../../orders/orders.service';
import { CommonModule } from '../common.module';
import { InventoryModule } from '../../inventory/inventory.module';
import { AuditModule } from '../../audit/audit.module';
import { PrismaClient } from '@prisma/client';

@Global()
@Module({
  imports: [CommonModule, InventoryModule, AuditModule],
  providers: [
    GeneralCycleNumberingService,
    RecoveryOrderService,
    AutomatedCollectionService,
    TempFileManagerService,
    PdfGeneratorService,
    RouteSheetGeneratorService,
    CancellationOrderReassignmentService,
    DeliveryEvidenceService,
    FirstCycleComodatoService,
    IncidentService,
    ManualCollectionService,
    MobileInventoryService,
    MultipleSubscriptionsService,
    OrderCollectionEditService,
    OverdueOrderService,
    RouteOptimizationService,
    SubscriptionCycleCalculatorService,
    SubscriptionCycleNumberingService,
    SubscriptionQuotaService,
    OrdersService,
    PrismaClient,
  ],
  exports: [
    GeneralCycleNumberingService,
    RecoveryOrderService,
    AutomatedCollectionService,
    TempFileManagerService,
    PdfGeneratorService,
    RouteSheetGeneratorService,
    CancellationOrderReassignmentService,
    DeliveryEvidenceService,
    FirstCycleComodatoService,
    IncidentService,
    ManualCollectionService,
    MobileInventoryService,
    MultipleSubscriptionsService,
    OrderCollectionEditService,
    OverdueOrderService,
    RouteOptimizationService,
    SubscriptionCycleCalculatorService,
    SubscriptionCycleNumberingService,
    SubscriptionQuotaService,
    OrdersService,
  ],
})
export class ServicesModule {}