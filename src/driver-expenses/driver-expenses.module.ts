import { Module } from '@nestjs/common';
import { DriverExpensesService } from './driver-expenses.service';
import {
  DriverExpensesAdminController,
  DriverExpensesController,
} from './driver-expenses.controller';

@Module({
  controllers: [DriverExpensesController, DriverExpensesAdminController],
  providers: [DriverExpensesService],
})
export class DriverExpensesModule {}
