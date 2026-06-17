import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';
import { resolveAccessTokenSecret } from '../utils/jwt-secret.util';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ConfigService)
    configService: ConfigService,
    private readonly prisma: PrismaService,
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
