import { Module } from '@nestjs/common';
import { PaymentSemaphoreService } from './services/payment-semaphore.service';
import { ScheduleService } from './services/schedule.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { SubscriptionCycleRenewalService } from './services/subscription-cycle-renewal.service';
import { FailedOrderReassignmentService } from './services/failed-order-reassignment.service';

@Module({
  providers: [PaymentSemaphoreService, ScheduleService, PdfGeneratorService, SubscriptionCycleRenewalService, FailedOrderReassignmentService],
  exports: [PaymentSemaphoreService, ScheduleService, PdfGeneratorService, SubscriptionCycleRenewalService, FailedOrderReassignmentService],
})
export class CommonModule {}