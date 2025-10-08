import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaClientInitializationError } from '@prisma/client/runtime/library';

@Injectable()
export class DatabaseConnectionService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseConnectionService.name);
  private readonly prisma = new PrismaClient();
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAY_MS = 5000; // 5 segundos

  async onModuleInit() {
    await this.connectWithRetry(1);
  }

  private async connectWithRetry(attempt: number): Promise<void> {
    try {
      // Intenta conectar a la base de datos
      await this.prisma.$connect();
      this.logger.log('Conexión a la base de datos establecida correctamente.');
    } catch (error) {
      if (error instanceof PrismaClientInitializationError) {
        if (attempt <= this.MAX_RETRIES) {
          this.logger.warn(
            `No se pudo conectar a la base de datos. Reintento ${attempt} de ${this.MAX_RETRIES} en ${this.RETRY_DELAY_MS / 1000} segundos...`,
          );

          // Esperar antes de reintentar
          await new Promise((resolve) =>
            setTimeout(resolve, this.RETRY_DELAY_MS),
          );

          // Reintentar conexión
          return this.connectWithRetry(attempt + 1);
        } else {
          this.logger.error(
            `No se pudo conectar a la base de datos después de ${this.MAX_RETRIES} intentos.`,
          );
          this.logger.error(
            'Por favor, verifique que el servidor de base de datos está en funcionamiento:',
          );
          this.logger.error('1. Compruebe que PostgreSQL está activo');
          this.logger.error(
            '2. Verifique la cadena de conexión en el archivo .env',
          );
          this.logger.error(
            '3. Asegúrese de que las credenciales sean correctas',
          );

          // Aquí puedes decidir si quieres dejar que la aplicación continúe o terminarla
          // Si quieres terminar la aplicación:
          // process.exit(1);
        }
      } else {
        throw error; // Propagar otros tipos de errores
      }
    }
  }

  // Método para verificar la salud de la conexión
  async checkHealth(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(
        'Error al verificar la salud de la base de datos:',
        error,
      );
      return false;
    }
  }
}
