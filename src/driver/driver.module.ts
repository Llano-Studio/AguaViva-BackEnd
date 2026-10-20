import { Module } from '@nestjs/common';
import { ServicesModule } from '../common/services/services.module';
import { DriverDeliveriesController } from './driver-deliveries.controller';
import { DriverPaymentsController } from './driver-payments.controller';
import { DriverRouteSheetsController } from './driver-route-sheets.controller';
import { DriverDeliveriesService } from './driver-deliveries.service';
import { DriverPaymentsService } from './driver-payments.service';
import { DriverRouteSheetsService } from './driver-route-sheets.service';

@Module({
  imports: [ServicesModule],
  controllers: [
    DriverRouteSheetsController,
    DriverDeliveriesController,
    DriverPaymentsController,
  ],
  providers: [
    DriverRouteSheetsService,
    DriverDeliveriesService,
    DriverPaymentsService,
  ],
  exports: [DriverRouteSheetsService],
})
export class DriverModule {}
