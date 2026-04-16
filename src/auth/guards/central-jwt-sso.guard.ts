import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import {
  CentralSsoPayload,
  SsoRequest,
} from '../interfaces/central-sso-payload.interface';

@Injectable()
export class CentralJwtSsoGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SsoRequest>();
    const token = this.extractToken(request);
    const jwtSecret = this.getCentralJwtSecret();
    const requiredSystem = this.getRequiredSystem();
    const issuer =
      this.configService.get<string>('CENTRAL_AUTH_ISSUER') || 'login-service';

    let payload: CentralSsoPayload;
    try {
      payload = jwt.verify(token, jwtSecret, {
        issuer,
        audience: requiredSystem,
      }) as CentralSsoPayload;
    } catch {
      throw new UnauthorizedException('Token central inválido o expirado');
    }

    if (!payload.userId || !payload.email || !payload.assignedSystem) {
      throw new UnauthorizedException('Token central inválido');
    }

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token central de sesión inválido');
    }

    if (payload.assignedSystem !== requiredSystem) {
      throw new UnauthorizedException(
        `El token no tiene acceso al sistema ${requiredSystem}`,
      );
    }

    request.centralUser = payload;
    return true;
  }

  private extractToken(request: SsoRequest) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token central requerido');
    }

    return authHeader.slice(7);
  }

  private getCentralJwtSecret() {
    const jwtSecret =
      this.configService.get<string>('LOGIN_SERVICE_JWT_SECRET') ||
      this.configService.get<string>('CENTRAL_AUTH_JWT_SECRET');

    if (!jwtSecret) {
      throw new InternalServerErrorException(
        'CENTRAL_AUTH_JWT_SECRET no configurado',
      );
    }

    return jwtSecret;
  }

  private getRequiredSystem() {
    return (
      this.configService.get<string>('MODULE_SYSTEM_CODE') ||
      this.configService.get<string>('CENTRAL_AUTH_SYSTEM_CODE') ||
      'AGUAVIVA'
    );
  }
}
