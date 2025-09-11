import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseConnectionService } from './common/services/database-connection.service';

@Injectable()
export class AppService {
  constructor(
    private readonly dbService: DatabaseConnectionService,
    private readonly configService: ConfigService,
  ) {}

  getHello(): string {
    return 'API de Agua Viva-Rica - Sistema de Gestión de Distribución';
  }

  async checkHealth() {
    const startTime = process.uptime();
    const dbHealth = await this.dbService.checkHealth();
    const environment =
      this.configService.get('app.app.environment') ||
      this.configService.get('NODE_ENV') ||
      'development';
    const version = this.configService.get('app.app.version') || '1.0.0';

    return {
      status: dbHealth ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      uptime: Math.floor(startTime), // tiempo en segundos
      version,
      environment,
    };
  }
}
