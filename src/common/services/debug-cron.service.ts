import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DebugCronService {
  private readonly logger = new Logger(DebugCronService.name);

  @Cron(CronExpression.EVERY_MINUTE)
  handleCron() {
    console.log('Debug Cron executed at: ' + new Date().toString());
    this.logger.log('Debug Cron executed at: ' + new Date().toString());
  }
}
