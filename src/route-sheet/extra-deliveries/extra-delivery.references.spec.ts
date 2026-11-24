import { loadDeliveryReference } from './extra-delivery.references';
import { PrismaService } from '../../prisma/prisma.service';

describe('loadDeliveryReference (AguaViva)', () => {
  it('compra única: usa su zona o la del cliente y su fecha programada', async () => {
    const prisma = {
      one_off_purchase_header: {
        findUnique: jest.fn().mockResolvedValue({
          purchase_header_id: 33,
          status: 'PENDING',
          delivery_status: 'PENDING',
          purchase_date: new Date('2026-11-20T15:00:00.000Z'),
          scheduled_delivery_date: new Date('2026-11-24T15:00:00.000Z'),
          zone_id: null,
          person: { zone_id: 6 },
        }),
      },
    } as unknown as PrismaService;

    expect(
      await loadDeliveryReference(prisma, {
        kind: 'one_off_purchase_header',
        id: 33,
      }),
    ).toEqual({
      delivery_ymd: '2026-11-24',
      zone_id: 6,
      is_deliverable: true,
      detail: { one_off_purchase_header_id: 33 },
      detail_where: { one_off_purchase_header_id: 33 },
    });
  });

  it('compra única ya entregada no es entregable', async () => {
    const prisma = {
      one_off_purchase_header: {
        findUnique: jest.fn().mockResolvedValue({
          purchase_header_id: 33,
          status: 'PENDING',
          delivery_status: 'DELIVERED',
          purchase_date: new Date('2026-11-24T15:00:00.000Z'),
          scheduled_delivery_date: null,
          zone_id: 2,
          person: { zone_id: 6 },
        }),
      },
    } as unknown as PrismaService;

    const reference = await loadDeliveryReference(prisma, {
      kind: 'one_off_purchase_header',
      id: 33,
    });
    expect(reference?.is_deliverable).toBe(false);
    expect(reference?.zone_id).toBe(2);
  });
});
