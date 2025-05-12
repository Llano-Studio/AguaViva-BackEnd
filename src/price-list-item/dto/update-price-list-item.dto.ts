import { PartialType } from '@nestjs/mapped-types';
import { CreatePriceListItemDto } from './create-price-list-item.dto';

export class UpdatePriceListItemDto extends PartialType(CreatePriceListItemDto) {} 