import { ValidationPipe } from '@nestjs/common';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { OrdersService } from './orders.service';

describe('OrdersService zone query filters', () => {
  it.each([
    [{ zone_ids: '2' }, [2]],
    [{ zone_ids: '2,3' }, [2, 3]],
    [{ zoneIds: '2,3' }, [2, 3]],
    [{ zone_id: '2' }, [2]],
    [{ zoneId: '2' }, [2]],
  ])('applies %j to the list and pagination count', async (zones, expected) => {
    const orderHeader = {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const service = new OrdersService(
      { order_header: orderHeader } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const pipe = new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
    });
    const metadata = { type: 'query' as const, metatype: FilterOrdersDto };
    const transformed = await pipe.transform(
      {
        ...zones,
        search: 'test',
        deliveryDateFrom: '2026-09-09',
        deliveryDateTo: '2026-09-09',
        statuses: 'PENDING',
        requires_delivery: 'true',
        page: '1',
        limit: '10',
      },
      metadata,
    );
    const dto = await new ValidationPipe().transform(transformed, metadata);

    await service.findAll(dto);

    const where = orderHeader.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      is_active: true,
      status: { in: ['PENDING'] },
      scheduled_delivery_date: {
        gte: new Date('2026-09-09T00:00:00.000Z'),
        lte: new Date('2026-09-09T23:59:59.999Z'),
        not: null,
      },
      AND: [
        {
          OR: [
            { zone_id: { in: expected } },
            {
              AND: [
                { zone_id: null },
                { customer: { zone_id: { in: expected } } },
              ],
            },
          ],
        },
      ],
      OR: expect.any(Array),
    });
    expect(orderHeader.count).toHaveBeenCalledWith({ where });
    expect(orderHeader.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });
});
