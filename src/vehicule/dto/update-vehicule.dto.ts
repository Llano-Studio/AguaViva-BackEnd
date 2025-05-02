import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleDto } from './create-vehicule.dto';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
