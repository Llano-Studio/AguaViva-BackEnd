import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PersonsModule } from './persons/persons.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { ZonesModule } from './zones/zones.module';
import { VehicleModule } from './vehicule/vehicle.module';
import { VehiculeInventoryModule } from './vehicule-inventory/vehicule-inventory.module';
import { ProductModule } from './product/product.module';
import { ProductCategoryModule } from './product-category/product-category.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PersonsModule, 
    AuthModule,
    MailModule,
    ZonesModule,
    VehicleModule,
    VehiculeInventoryModule,
    ProductModule,
    ProductCategoryModule,
  ],
})
export class AppModule {}
