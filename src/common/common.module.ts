import { Module } from '@nestjs/common';
import { PaymentSemaphoreService } from './services/payment-semaphore.service';
import { ScheduleService } from './services/schedule.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { SubscriptionCycleRenewalService } from './services/subscription-cycle-renewal.service';
import { FailedOrderReassignmentService } from './services/failed-order-reassignment.service';
import { PrismaClient } from '@prisma/client';
import { SubscriptionCycleNumberingService } from './services/subscription-cycle-numbering.service';
import { SubscriptionCycleCalculatorService } from './services/subscription-cycle-calculator.service';
import { PdfDevController } from './controllers/pdf-dev.controller';
import { TempFileManagerService } from './services/temp-file-manager.service';

@Module({
  imports: [],
  controllers: [PdfDevController],
  providers: [
    PaymentSemaphoreService,
    ScheduleService,
    PdfGeneratorService,
    TempFileManagerService,
    SubscriptionCycleRenewalService,
    FailedOrderReassignmentService,
    SubscriptionCycleNumberingService,
    SubscriptionCycleCalculatorService,
    PrismaClient,
  ],
  exports: [
    PaymentSemaphoreService,
    ScheduleService,
    PdfGeneratorService,
    TempFileManagerService,
    SubscriptionCycleRenewalService,
    FailedOrderReassignmentService,
    SubscriptionCycleNumberingService,
    SubscriptionCycleCalculatorService,
    PrismaClient,
  ],
})
export class CommonModule {}
