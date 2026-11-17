import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { OrdersModule } from '../orders/orders.module';
import { LoginServiceClient } from './services/login-service.client';
import { ClientPortalJwtGuard } from './guards/client-portal-jwt.guard';

@Module({
  imports: [ConfigModule, OrdersModule, JwtModule.register({})],
  controllers: [PortalController],
  providers: [PortalService, LoginServiceClient, ClientPortalJwtGuard],
  exports: [PortalService, LoginServiceClient, ClientPortalJwtGuard],
})
export class PortalModule {}
