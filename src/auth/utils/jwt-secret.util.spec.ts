import { ConfigService } from '@nestjs/config';
import {
  resolveAccessTokenSecret,
  resolveRefreshTokenSecret,
} from './jwt-secret.util';

describe('jwt-secret.util', () => {
  const makeConfigService = (values: Record<string, string | undefined>) => {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  describe('resolveAccessTokenSecret', () => {
    it('prioriza app.jwt.secret', () => {
      const configService = makeConfigService({
        'app.jwt.secret': 'app-secret',
        JWT_SECRET: 'jwt-secret',
      });

      expect(resolveAccessTokenSecret(configService)).toBe('app-secret');
    });

    it('usa JWT_SECRET si no hay app.jwt.secret', () => {
      const configService = makeConfigService({
        JWT_SECRET: 'jwt-secret',
      });

      expect(resolveAccessTokenSecret(configService)).toBe('jwt-secret');
    });

    it('usa fallback si no hay secretos configurados', () => {
      const configService = makeConfigService({});

      expect(resolveAccessTokenSecret(configService)).toBe('sgarav-secret-key');
    });
  });

  describe('resolveRefreshTokenSecret', () => {
    it('prioriza JWT_REFRESH_TOKEN_SECRET', () => {
      const configService = makeConfigService({
        JWT_REFRESH_TOKEN_SECRET: 'refresh-secret',
        JWT_SECRET: 'jwt-secret',
        'app.jwt.secret': 'app-secret',
      });

      expect(resolveRefreshTokenSecret(configService)).toBe('refresh-secret');
    });

    it('usa JWT_SECRET si no hay JWT_REFRESH_TOKEN_SECRET', () => {
      const configService = makeConfigService({
        JWT_SECRET: 'jwt-secret',
        'app.jwt.secret': 'app-secret',
      });

      expect(resolveRefreshTokenSecret(configService)).toBe('jwt-secret');
    });

    it('usa app.jwt.secret si no hay JWT_REFRESH_TOKEN_SECRET ni JWT_SECRET', () => {
      const configService = makeConfigService({
        'app.jwt.secret': 'app-secret',
      });

      expect(resolveRefreshTokenSecret(configService)).toBe('app-secret');
    });

    it('usa fallback si no hay secretos configurados', () => {
      const configService = makeConfigService({});

      expect(resolveRefreshTokenSecret(configService)).toBe('sgarav-secret-key');
    });
  });
});
