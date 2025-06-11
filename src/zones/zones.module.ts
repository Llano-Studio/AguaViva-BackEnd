import { Module } from '@nestjs/common';
import { ZonesService } from './zones.service';
import { ZonesController } from './zones.controller';
import { VehicleService } from '../vehicule/vehicle.service';

@Module({
  controllers: [ZonesController],
  providers: [ZonesService, VehicleService],
})
export class ZonesModule {}
