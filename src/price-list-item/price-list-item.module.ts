import { Module } from '@nestjs/common';
import { PriceListItemService } from './price-list-item.service';
import { PriceListItemController } from './price-list-item.controller';

@Module({
  controllers: [PriceListItemController],
  providers: [PriceListItemService],
})
export class PriceListItemModule {}
