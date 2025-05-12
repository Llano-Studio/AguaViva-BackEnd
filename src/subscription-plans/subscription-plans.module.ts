import { Module } from '@nestjs/common';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionPlansController } from './subscription-plans.controller';
import { PrismaClient } from '@prisma/client';

@Module({
  controllers: [SubscriptionPlansController],
  providers: [SubscriptionPlansService, PrismaClient],
  exports: [SubscriptionPlansService],
})
export class SubscriptionPlansModule {} 