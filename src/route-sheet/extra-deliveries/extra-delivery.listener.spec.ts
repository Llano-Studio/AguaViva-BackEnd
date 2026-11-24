import { ExtraDeliveryListener } from './extra-delivery.listener';
import { ExtraDeliveryService } from './extra-delivery.service';

describe('ExtraDeliveryListener', () => {
  it('pasa el evento al servicio', async () => {
    const service = {
      handleDeliveryCreated: jest.fn().mockResolvedValue({ status: 'ADDED' }),
    };
    const listener = new ExtraDeliveryListener(
      service as unknown as ExtraDeliveryService,
    );

    await listener.onDeliveryCreated({ kind: 'order', id: 7 });

    expect(service.handleDeliveryCreated).toHaveBeenCalledWith({
      kind: 'order',
      id: 7,
    });
  });

  it('un error al evaluar el extra no se propaga a la creación del pedido', async () => {
    const service = {
      handleDeliveryCreated: jest.fn().mockRejectedValue(new Error('db caída')),
    };
    const listener = new ExtraDeliveryListener(
      service as unknown as ExtraDeliveryService,
    );

    await expect(
      listener.onDeliveryCreated({ kind: 'order', id: 7 }),
    ).resolves.toBeUndefined();
  });
});
