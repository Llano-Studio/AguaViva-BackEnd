import { Module } from '@nestjs/common';
import { PaymentSemaphoreService } from './services/payment-semaphore.service';
import { ScheduleService } from './services/schedule.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { RouteSheetGeneratorService } from './services/route-sheet-generator.service';
import { SubscriptionCycleRenewalService } from './services/subscription-cycle-renewal.service';
import { FailedOrderReassignmentService } from './services/failed-order-reassignment.service';
import { SubscriptionCycleNumberingService } from './services/subscription-cycle-numbering.service';
import { SubscriptionCycleCalculatorService } from './services/subscription-cycle-calculator.service';
import { PdfDevController } from './controllers/pdf-dev.controller';
import { TempFileManagerService } from './services/temp-file-manager.service';

const devControllers =
  process.env.NODE_ENV !== 'production' ? [PdfDevController] : [];

@Module({
  imports: [],
  controllers: [...devControllers],
  providers: [
    PaymentSemaphoreService,
    ScheduleService,
    PdfGeneratorService,
    RouteSheetGeneratorService,
    TempFileManagerService,
    SubscriptionCycleRenewalService,
    FailedOrderReassignmentService,
    SubscriptionCycleNumberingService,
    SubscriptionCycleCalculatorService,
  ],
  exports: [
    PaymentSemaphoreService,
    ScheduleService,
    PdfGeneratorService,
    RouteSheetGeneratorService,
    TempFileManagerService,
    SubscriptionCycleRenewalService,
    FailedOrderReassignmentService,
    SubscriptionCycleNumberingService,
    SubscriptionCycleCalculatorService,
  ],
})
export class CommonModule {}
