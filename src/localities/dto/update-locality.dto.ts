import { PartialType } from '@nestjs/swagger';
import { CreateLocalityDto } from './create-locality.dto';

export class UpdateLocalityDto extends PartialType(CreateLocalityDto) {}