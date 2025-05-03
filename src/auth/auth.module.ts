import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { RolesService } from './roles.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports:[ConfigModule],
      inject:[ConfigService],
      useFactory: (configService: ConfigService) => {
       return {
        secret: configService.get('JWT_SECRET') || 'sgarav-secret-key',
        signOptions: { expiresIn: '24h' },
       }
      }
    }),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesService],
  exports: [JwtStrategy, PassportModule, AuthService, RolesService],
})
export class AuthModule {}
