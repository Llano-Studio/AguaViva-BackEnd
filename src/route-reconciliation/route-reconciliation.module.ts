import { Module } from '@nestjs/common';
import { RouteReconciliationService } from './route-reconciliation.service';
import { DriverReconciliationController } from './driver-reconciliation.controller';
import { RouteReconciliationAdminController } from './route-reconciliation-admin.controller';

@Module({
  controllers: [
    DriverReconciliationController,
    RouteReconciliationAdminController,
  ],
  providers: [RouteReconciliationService],
  exports: [RouteReconciliationService],
})
export class RouteReconciliationModule {}
