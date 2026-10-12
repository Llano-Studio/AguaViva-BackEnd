import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type SystemCode = 'AGUAVIVA';

@Injectable()
export class LoginServiceClient {
  private readonly logger = new Logger(LoginServiceClient.name);

  constructor(private readonly configService: ConfigService) {}

  async syncCredential(payload: {
    system: SystemCode;
    customerId: number;
    phone: string;
    password: string;
    isActive?: boolean;
  }): Promise<{ id: number } | null> {
    const baseUrl = this.configService.get<string>('LOGIN_SERVICE_URL');
    const secret = this.configService.get<string>('INTERNAL_SERVICE_SECRET');
    if (!baseUrl || !secret) {
      this.logger.warn(
        'LOGIN_SERVICE_URL o INTERNAL_SERVICE_SECRET no configurados. Se omite sync.',
      );
      return null;
    }
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/client/internal/credentials/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': secret,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(
          `Error sincronizando credencial en login-service (${res.status}): ${text}`,
        );
        return null;
      }
      return (await res.json()) as { id: number };
    } catch (err) {
      this.logger.error(
        `Fallo de red al sincronizar credencial con login-service: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async disableCredential(system: SystemCode, customerId: number): Promise<boolean> {
    const baseUrl = this.configService.get<string>('LOGIN_SERVICE_URL');
    const secret = this.configService.get<string>('INTERNAL_SERVICE_SECRET');
    if (!baseUrl || !secret) {
      this.logger.warn(
        'LOGIN_SERVICE_URL o INTERNAL_SERVICE_SECRET no configurados. Se omite disable.',
      );
      return false;
    }
    try {
      const res = await fetch(
        `${baseUrl.replace(/\/$/, '')}/client/internal/credentials/${system}/${customerId}`,
        {
          method: 'DELETE',
          headers: { 'x-internal-secret': secret },
        },
      );
      return res.ok;
    } catch (err) {
      this.logger.error(
        `Fallo de red al desactivar credencial en login-service: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
