import { Module } from '@nestjs/common';
import { DriverDeliveriesController } from './driver-deliveries.controller';
import { DriverRouteSheetsController } from './driver-route-sheets.controller';
import { DriverRouteSheetsService } from './driver-route-sheets.service';

@Module({
  controllers: [DriverRouteSheetsController, DriverDeliveriesController],
  providers: [DriverRouteSheetsService],
  exports: [DriverRouteSheetsService],
})
export class DriverModule {}
