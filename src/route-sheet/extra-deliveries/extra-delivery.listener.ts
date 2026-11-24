import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DELIVERY_CREATED_EVENT,
  DeliveryCreatedEvent,
} from './extra-delivery.events';
import { ExtraDeliveryService } from './extra-delivery.service';

/**
 * Escucha la creación de envíos y los agrega como extra a la hoja que
 * corresponda. Corre en segundo plano: nunca demora ni hace fallar la creación
 * del pedido.
 */
@Injectable()
export class ExtraDeliveryListener {
  private readonly logger = new Logger(ExtraDeliveryListener.name);

  constructor(private readonly extraDeliveryService: ExtraDeliveryService) {}

  @OnEvent(DELIVERY_CREATED_EVENT, { async: true })
  async onDeliveryCreated(event: DeliveryCreatedEvent): Promise<void> {
    try {
      await this.extraDeliveryService.handleDeliveryCreated(event);
    } catch (error) {
      this.logger.error(
        `No se pudo evaluar ${event.kind} ${event.id} como pedido extra: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
