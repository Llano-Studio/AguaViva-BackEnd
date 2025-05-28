import { Module } from '@nestjs/common';
import { PaymentSemaphoreService } from './services/payment-semaphore.service';

@Module({
  providers: [PaymentSemaphoreService],
  exports: [PaymentSemaphoreService],
})
export class CommonModule {} 