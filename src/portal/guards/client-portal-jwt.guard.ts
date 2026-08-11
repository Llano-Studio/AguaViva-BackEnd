import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { CLIENT_PORTAL_CONFIG } from '../portal.constants';

type SystemType = 'AGUAVIVA';

export type ClientPortalPayload = {
  sub: string;
  clientId: number;
  customerId: number;
  system: SystemType;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
};

export type ClientPortalRequest = Request & {
  clientPortal?: ClientPortalPayload;
};

@Injectable()
export class ClientPortalJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ClientPortalRequest>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }

    const secret = this.getSecret();
    const expectedSystem = this.getExpectedSystem();

    try {
      const payload = await this.jwtService.verifyAsync<ClientPortalPayload>(token, {
        secret,
        issuer: CLIENT_PORTAL_CONFIG.ISSUER,
        audience: CLIENT_PORTAL_CONFIG.AUDIENCE,
      });

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Token inválido (no es de acceso)');
      }
      if (!payload.clientId || !payload.customerId || !payload.system) {
        throw new UnauthorizedException('Token malformado');
      }
      if (payload.system !== expectedSystem) {
        throw new UnauthorizedException(
          `El token no corresponde al sistema ${expectedSystem}`,
        );
      }
      request.clientPortal = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private getSecret() {
    const secret =
      this.configService.get<string>('CLIENT_PORTAL_JWT_SECRET') ??
      this.configService.get<string>('LOGIN_SERVICE_JWT_SECRET') ??
      this.configService.get<string>('CENTRAL_AUTH_JWT_SECRET') ??
      this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Secreto de JWT no configurado');
    }
    return secret;
  }

  private getExpectedSystem(): SystemType {
    const code =
      this.configService.get<string>('MODULE_SYSTEM_CODE') ??
      this.configService.get<string>('CENTRAL_AUTH_SYSTEM_CODE') ??
      'AGUAVIVA';
    return code as SystemType;
  }
}
