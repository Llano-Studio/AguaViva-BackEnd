import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PersonsModule } from './persons/persons.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { ZonesModule } from './zones/zones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PersonsModule, 
    AuthModule,
    MailModule,
    ZonesModule,
  ],
})
export class AppModule {}
