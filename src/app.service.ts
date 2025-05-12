import { Injectable } from '@nestjs/common';
import { DatabaseConnectionService } from './common/services/database-connection.service';

@Injectable()
export class AppService {
  constructor(private readonly dbService: DatabaseConnectionService) {}

  getHello(): string {
    return 'API de Agua Viva-Rica - Sistema de Gestión de Distribución';
  }

  async checkHealth() {
    const startTime = process.uptime();
    const dbHealth = await this.dbService.checkHealth();
    
    return {
      status: dbHealth ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      uptime: Math.floor(startTime), // tiempo en segundos
      version: '1.0.0'
    };
  }
} 