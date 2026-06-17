import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaService;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  constructor() {
    if (globalForPrisma.prisma) {
      return globalForPrisma.prisma;
    }

    super();
    globalForPrisma.prisma = this;
  }

  async onModuleInit() {
    if (this.isConnected) {
      return;
    }

    await this.$connect();
    this.isConnected = true;
    this.logger.log('Cliente Prisma singleton inicializado.');
  }

  async onModuleDestroy() {
    if (!this.isConnected) {
      return;
    }

    await this.$disconnect();
    this.isConnected = false;
  }
}

export const prismaSingleton =
  globalForPrisma.prisma ?? new PrismaService();
