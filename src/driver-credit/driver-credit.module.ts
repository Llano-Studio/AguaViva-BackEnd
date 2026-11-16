import { Module } from '@nestjs/common';
import { DriverCreditService } from './driver-credit.service';
import { DriverCreditAdminController } from './driver-credit-admin.controller';
import { DriverCreditDriverController } from './driver-credit-driver.controller';

@Module({
  controllers: [DriverCreditAdminController, DriverCreditDriverController],
  providers: [DriverCreditService],
  exports: [DriverCreditService],
})
export class DriverCreditModule {}
