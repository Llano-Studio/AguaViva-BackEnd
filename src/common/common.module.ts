import { Module } from '@nestjs/common';
import { PaymentSemaphoreService } from './services/payment-semaphore.service';
import { ScheduleService } from './services/schedule.service';

@Module({
  providers: [PaymentSemaphoreService, ScheduleService],
  exports: [PaymentSemaphoreService, ScheduleService],
})
export class CommonModule {} 