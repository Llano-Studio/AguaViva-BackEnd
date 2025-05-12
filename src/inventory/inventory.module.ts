import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { PrismaClient } from '@prisma/client';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, PrismaClient], 
  exports: [InventoryService] 
})
export class InventoryModule {} 