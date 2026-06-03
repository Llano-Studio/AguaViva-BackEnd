import { ConfigService } from '@nestjs/config';

export function resolveAccessTokenSecret(configService: ConfigService): string {
  return (
    configService.get<string>('app.jwt.secret') ||
    configService.get<string>('JWT_SECRET') ||
    'sgarav-secret-key'
  );
}

export function resolveRefreshTokenSecret(configService: ConfigService): string {
  return (
    configService.get<string>('JWT_REFRESH_TOKEN_SECRET') ||
    configService.get<string>('JWT_SECRET') ||
    configService.get<string>('app.jwt.secret') ||
    'sgarav-secret-key'
  );
}
