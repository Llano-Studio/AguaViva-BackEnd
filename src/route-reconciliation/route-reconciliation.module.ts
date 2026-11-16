import { Module } from '@nestjs/common';
import { DriverCreditModule } from '../driver-credit/driver-credit.module';
import { RouteReconciliationService } from './route-reconciliation.service';
import { DriverReconciliationController } from './driver-reconciliation.controller';
import { RouteReconciliationAdminController } from './route-reconciliation-admin.controller';

@Module({
  imports: [DriverCreditModule],
  controllers: [
    DriverReconciliationController,
    RouteReconciliationAdminController,
  ],
  providers: [RouteReconciliationService],
  exports: [RouteReconciliationService],
})
export class RouteReconciliationModule {}
