import { Module } from '@nestjs/common';
import { CustomerAccountsController } from './customer-accounts.controller';
import { CustomerAccountsService } from './customer-accounts.service';
import { CustomerAccountSourcesService } from './customer-account-sources.service';

@Module({
  controllers: [CustomerAccountsController],
  providers: [CustomerAccountsService, CustomerAccountSourcesService],
  exports: [CustomerAccountsService],
})
export class CustomerAccountsModule {}
