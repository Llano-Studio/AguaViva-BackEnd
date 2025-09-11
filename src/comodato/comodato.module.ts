import { Module } from '@nestjs/common';
import { ComodatoController } from './comodato.controller';
import { PersonsModule } from '../persons/persons.module';

@Module({
  imports: [PersonsModule],
  controllers: [ComodatoController],
})
export class ComodatoModule {}