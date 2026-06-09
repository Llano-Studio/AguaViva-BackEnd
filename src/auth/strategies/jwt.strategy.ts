import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaClient } from '@prisma/client';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';
import { resolveAccessTokenSecret } from '../utils/jwt-secret.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private prisma = new PrismaClient();

  constructor(
    @Inject(ConfigService)
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: resolveAccessTokenSecret(configService),
    });
  }

  async validate(payload: JwtPayload) {
    const { id } = payload;
    const userId = typeof id === 'string' ? parseInt(id, 10) : id;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Token no válido');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario no activo');
    }

    return user;
  }
}
