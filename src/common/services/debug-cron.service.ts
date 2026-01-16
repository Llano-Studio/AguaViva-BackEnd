import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DebugCronService {
  private readonly logger = new Logger(DebugCronService.name);

  // Cron decorator removed to clean up logs
  handleCron() {
    this.logger.debug(
      `Debug Cron executed at: ${new Date().toString()} (Local time check)`,
    );
  }
}
