import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { PersonsModule } from './persons/persons.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { ZonesModule } from './zones/zones.module';
import { CountriesModule } from './countries/countries.module';
import { ProvincesModule } from './provinces/provinces.module';
import { LocalitiesModule } from './localities/localities.module';
import { VehicleModule } from './vehicule/vehicle.module';
import { VehiculeInventoryModule } from './vehicule-inventory/vehicule-inventory.module';
import { ProductModule } from './product/product.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { PriceListModule } from './price-list/price-list.module';
import { PriceListItemModule } from './price-list-item/price-list-item.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { RouteSheetModule } from './route-sheet/route-sheet.module';
import { SubscriptionPlansModule } from './subscription-plans/subscription-plans.module';
import { CustomerSubscriptionModule } from './customer-subscription/customer-subscription.module';
import { CommonModule } from './common/common.module';
import { DatabaseConnectionService } from './common/services/database-connection.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import environmentConfig from './common/config/environment.config';

@Module({
  imports: [
    CommonModule,
    PersonsModule, 
    AuthModule,
    MailModule,
    ZonesModule,
    CountriesModule,
    ProvincesModule,
    LocalitiesModule,
    VehicleModule,
    VehiculeInventoryModule,
    ProductModule,
    ProductCategoryModule,
    PriceListModule,
    PriceListItemModule,
    OrdersModule,
    InventoryModule,
    RouteSheetModule,
    SubscriptionPlansModule,
    CustomerSubscriptionModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 60,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [environmentConfig],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    DatabaseConnectionService,
  ],
})
export class AppModule {}
