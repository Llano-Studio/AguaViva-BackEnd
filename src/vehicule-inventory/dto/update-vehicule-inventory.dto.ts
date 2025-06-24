import { PartialType } from '@nestjs/swagger';
import { CreateVehicleInventoryDto } from './create-vehicule-inventory.dto';

export class UpdateVehicleInventoryDto extends PartialType(CreateVehicleInventoryDto) {}