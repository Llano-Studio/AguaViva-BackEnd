import { PartialType } from '@nestjs/swagger';
import { CreateVehiculeInventoryDto } from './create-vehicule-inventory.dto';

export class UpdateVehiculeInventoryDto extends PartialType(
  CreateVehiculeInventoryDto,
) {}
