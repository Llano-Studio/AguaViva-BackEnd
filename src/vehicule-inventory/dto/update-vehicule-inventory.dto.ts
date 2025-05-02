import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleInventoryDto } from './create-vehicule-inventory.dto';

export class UpdateVehicleInventoryDto extends PartialType(CreateVehicleInventoryDto) {}