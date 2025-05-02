import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PersonsModule } from './persons/persons.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { ZonesModule } from './zones/zones.module';
import { VehiculeModule } from './vehicule/vehicule.module';
import { VehiculeInventoryModule } from './vehicule-inventory/vehicule-inventory.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PersonsModule, 
    AuthModule,
    MailModule,
    ZonesModule,
    VehiculeModule,
    VehiculeInventoryModule,
  ],
})
export class AppModule {}
