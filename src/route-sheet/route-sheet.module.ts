import { Module } from '@nestjs/common';
import { RouteSheetService } from './route-sheet.service';
import { RouteSheetController } from './route-sheet.controller';
import { PrismaClient } from '@prisma/client';
import { RouteOptimizationService } from './services/route-optimization.service';
import { MobileInventoryService } from './services/mobile-inventory.service';

@Module({
  controllers: [RouteSheetController],
  providers: [
    RouteSheetService, 
    PrismaClient,
    RouteOptimizationService,
    MobileInventoryService
  ],
  exports: [
    RouteSheetService,
    RouteOptimizationService,
    MobileInventoryService
  ]
})
export class RouteSheetModule {} 