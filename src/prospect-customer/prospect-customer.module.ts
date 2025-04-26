import { Module } from '@nestjs/common';
import { ProspectCustomersService } from './prospect-customer.service';
import { ProspectCustomersController } from './prospect-customer.controller';

@Module({
  controllers: [ProspectCustomersController],
  providers: [ProspectCustomersService],
})
export class ProspectCustomerModule {}
