import { ValidationPipe } from '@nestjs/common';
import { OrderStatus, OrderType } from '../../common/constants/enums';
import { FilterOrdersDto } from './filter-orders.dto';

describe('FilterOrdersDto query aliases', () => {
  const transformQuery = async (query: Record<string, unknown>) => {
    const metadata = { type: 'query' as const, metatype: FilterOrdersDto };
    const globalPipe = new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    const dto = await globalPipe.transform(query, metadata);
    return new ValidationPipe().transform(dto, metadata);
  };

  it.each([
    [{ zone_ids: '2' }, [2]],
    [{ zone_ids: '2,3' }, [2, 3]],
    [{ zone_ids: ['2', '3'] }, [2, 3]],
    [{ zoneIds: '2' }, [2]],
    [{ zoneIds: '2,3' }, [2, 3]],
    [{ zoneIds: ['2', '3'] }, [2, 3]],
    [{ zoneIds: '3', zone_ids: '2' }, [3]],
    [{ zoneIds: '', zone_ids: '2' }, [2]],
  ])('transforms zones from %j', async (query, expected) => {
    const dto = await transformQuery(query);
    expect(dto.zoneIds).toEqual(expected);
    expect(dto).not.toHaveProperty('zone_ids');
  });

  it('preserves all filters from the reported request', async () => {
    const dto = await transformQuery({
      search: '',
      deliveryDateFrom: '2026-09-09',
      deliveryDateTo: '2026-09-09',
      statuses: 'PENDING',
      requires_delivery: 'true',
      zone_ids: '2',
      page: '1',
      limit: '10',
    });
    expect(dto).toMatchObject({
      deliveryDateFrom: '2026-09-09',
      deliveryDateTo: '2026-09-09',
      statuses: [OrderStatus.PENDING],
      requiresDelivery: true,
      zoneIds: [2],
      page: 1,
      limit: 10,
    });
  });

  it('transforms the other supported snake_case aliases', async () => {
    const orderType = Object.values(OrderType)[0];
    const dto = await transformQuery({
      customer_name: 'test',
      order_date_from: '2026-09-08',
      order_date_to: '2026-09-09',
      delivery_date_from: '2026-09-09',
      delivery_date_to: '2026-09-09',
      order_types: orderType,
      customer_id: '1',
      customer_ids: '1,2',
      order_id: '21',
      zone_id: '2',
      vehicle_id: '3',
      vehicle_ids: '3,4',
    });
    expect(dto).toMatchObject({
      customerName: 'test',
      orderDateFrom: '2026-09-08',
      orderDateTo: '2026-09-09',
      deliveryDateFrom: '2026-09-09',
      deliveryDateTo: '2026-09-09',
      orderTypes: [orderType],
      customerId: 1,
      customerIds: [1, 2],
      orderId: 21,
      zoneId: 2,
      vehicleId: 3,
      vehicleIds: [3, 4],
    });
  });

  it.each([
    { requires_delivery: 'false' },
    { requiresDelivery: 'false' },
    { requiresDelivery: false, requires_delivery: 'true' },
  ])('preserves false delivery filters from %j', async (query) => {
    expect((await transformQuery(query)).requiresDelivery).toBe(false);
  });

  it('leaves omitted optional filters undefined', async () => {
    const dto = await transformQuery({});
    expect(dto.zoneIds).toBeUndefined();
    expect(dto.zoneId).toBeUndefined();
    expect(dto.requiresDelivery).toBeUndefined();
  });
});
