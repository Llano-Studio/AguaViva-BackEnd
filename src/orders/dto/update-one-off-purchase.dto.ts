import { PartialType } from '@nestjs/mapped-types';
import { CreateOneOffPurchaseDto } from './create-one-off-purchase.dto';

export class UpdateOneOffPurchaseDto extends PartialType(CreateOneOffPurchaseDto) {} 