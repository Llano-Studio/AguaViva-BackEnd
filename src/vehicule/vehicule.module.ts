import { Module } from '@nestjs/common';
import { VehiculeController } from './vehicule.controller';
import { VehicleService } from './vehicule.service';

@Module({
  controllers: [VehiculeController],
  providers: [VehicleService],
})
export class VehiculeModule {}
