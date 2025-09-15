import { Module } from '@nestjs/common';
import { PaymentSemaphoreService } from './services/payment-semaphore.service';
import { ScheduleService } from './services/schedule.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { SubscriptionCycleRenewalService } from './services/subscription-cycle-renewal.service';
import { FailedOrderReassignmentService } from './services/failed-order-reassignment.service';
import { PrismaClient } from '@prisma/client';
import { CycleNumberingService } from '../customer-subscription/services/cycle-numbering.service';
import { SubscriptionCycleCalculatorService } from '../customer-subscription/services/subscription-cycle-calculator.service';

@Module({
  imports: [],
  providers: [
    PaymentSemaphoreService,
    ScheduleService,
    PdfGeneratorService,
    SubscriptionCycleRenewalService,
    FailedOrderReassignmentService,
    CycleNumberingService,
    SubscriptionCycleCalculatorService,
    PrismaClient,
  ],
  exports: [
    PaymentSemaphoreService,
    ScheduleService,
    PdfGeneratorService,
    SubscriptionCycleRenewalService,
    FailedOrderReassignmentService,
    CycleNumberingService,
    SubscriptionCycleCalculatorService,
    PrismaClient,
  ],
})
export class CommonModule {}
