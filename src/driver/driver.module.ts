import { Module } from '@nestjs/common';
import { DriverRouteSheetsController } from './driver-route-sheets.controller';
import { DriverRouteSheetsService } from './driver-route-sheets.service';

@Module({
  controllers: [DriverRouteSheetsController],
  providers: [DriverRouteSheetsService],
  exports: [DriverRouteSheetsService],
})
export class DriverModule {}
