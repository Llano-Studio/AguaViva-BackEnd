import { Module } from '@nestjs/common';
import { VehicleInventoryController } from './vehicule-inventory.controller';
import { VehicleInventoryService } from './vehicule-inventory.service';

@Module({
  controllers: [VehicleInventoryController],
  providers: [VehicleInventoryService],
})
export class VehiculeInventoryModule {}
