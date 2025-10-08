import { Module } from '@nestjs/common';
import { RouteSheetService } from './route-sheet.service';
import { RouteSheetController } from './route-sheet.controller';
import { RouteOptimizationService } from '../common/services/route-optimization.service';
import { MobileInventoryService } from '../common/services/mobile-inventory.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [RouteSheetController],
  providers: [
    RouteSheetService,
    RouteOptimizationService,
    MobileInventoryService,
  ],
  exports: [
    RouteSheetService,
    RouteOptimizationService,
    MobileInventoryService,
  ],
})
export class RouteSheetModule {}
