import { Module } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService],
  imports: [AuthModule, CommonModule],
})
export class PersonsModule {}
