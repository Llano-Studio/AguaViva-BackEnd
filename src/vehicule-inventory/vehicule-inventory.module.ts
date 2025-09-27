import { Module } from '@nestjs/common';
import { VehiculeInventoryController } from './vehicule-inventory.controller';
import { VehiculeInventoryService } from './vehicule-inventory.service';

@Module({
  controllers: [VehiculeInventoryController],
  providers: [VehiculeInventoryService],
})
export class VehiculeInventoryModule {}
