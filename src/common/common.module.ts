import { Module } from '@nestjs/common';
import { PaymentSemaphoreService } from './services/payment-semaphore.service';
import { ScheduleService } from './services/schedule.service';
import { PdfGeneratorService } from './services/pdf-generator.service';

@Module({
  providers: [PaymentSemaphoreService, ScheduleService, PdfGeneratorService],
  exports: [PaymentSemaphoreService, ScheduleService, PdfGeneratorService],
})
export class CommonModule {} 