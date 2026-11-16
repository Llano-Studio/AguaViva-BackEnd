import { Module } from '@nestjs/common';
import { ServicesModule } from '../common/services/services.module';
import { DriverCreditModule } from '../driver-credit/driver-credit.module';
import { DriverDeliveriesController } from './driver-deliveries.controller';
import { DriverPaymentsController } from './driver-payments.controller';
import { DriverRouteSheetsController } from './driver-route-sheets.controller';
import { DriverDeliveriesService } from './driver-deliveries.service';
import { DriverPaymentsService } from './driver-payments.service';
import { DriverRouteSheetsService } from './driver-route-sheets.service';
import { DriverQuantityEditService } from './driver-quantity-edit.service';
import {
  DriverQuantityEditController,
  QuantityEditAdminController,
} from './driver-quantity-edit.controller';

@Module({
  imports: [ServicesModule, DriverCreditModule],
  controllers: [
    DriverRouteSheetsController,
    DriverDeliveriesController,
    DriverPaymentsController,
    DriverQuantityEditController,
    QuantityEditAdminController,
  ],
  providers: [
    DriverRouteSheetsService,
    DriverDeliveriesService,
    DriverPaymentsService,
    DriverQuantityEditService,
  ],
  exports: [DriverRouteSheetsService],
})
export class DriverModule {}
