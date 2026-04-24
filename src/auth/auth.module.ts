import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserController } from './user.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { MailModule } from '../mail/mail.module';
import { RolesService } from './roles.service';
import { CentralJwtSsoGuard } from './guards/central-jwt-sso.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          secret:
            configService.get('app.jwt.secret') ||
            configService.get('JWT_SECRET') ||
            'sgarav-secret-key',
          signOptions: {
            expiresIn:
              configService.get('app.jwt.expiresIn') ||
              configService.get('JWT_EXPIRES_IN') ||
              '4h',
          },
        };
      },
    }),
    MailModule,
  ],
  controllers: [AuthController, UserController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    RolesService,
    CentralJwtSsoGuard,
  ],
  exports: [JwtStrategy, PassportModule, AuthService, RolesService],
})
export class AuthModule {}
