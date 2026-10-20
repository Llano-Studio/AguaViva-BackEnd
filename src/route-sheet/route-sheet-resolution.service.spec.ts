import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RouteSheetService } from './route-sheet.service';
import { SkipDeliveryReason } from './dto/skip-delivery.dto';

const DRIVER_ID = 3;
const VEHICLE_ID = 1;

function prismaMock() {
  const prisma: any = {
    route_sheet: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    route_sheet_detail: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    delivery_incident: { create: jest.fn() },
    order_header: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    one_off_purchase: { findMany: jest.fn() },
    one_off_purchase_header: { findMany: jest.fn() },
    cycle_payment: { findMany: jest.fn() },
  };
  prisma.$transaction = jest.fn((callback: (tx: any) => unknown) =>
    callback(prisma),
  );
  return prisma;
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    route_sheet_detail_id: 101,
    route_sheet_id: 5,
    order_id: 77,
    one_off_purchase_id: null,
    one_off_purchase_header_id: null,
    cycle_payment_id: null,
    delivery_status: 'PENDING',
    reschedule_date: null,
    comments: null,
    route_sheet: {
      route_sheet_id: 5,
      delivery_date: new Date('2026-10-20T00:00:00.000Z'),
      driver_id: DRIVER_ID,
      vehicle_id: VEHICLE_ID,
      is_active: true,
    },
    ...overrides,
  };
}

describe('RouteSheetService - resolución de paradas (Fase 6)', () => {
  let prisma: any;
  let service: RouteSheetService;

  beforeEach(() => {
    prisma = prismaMock();
    service = new RouteSheetService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({ route_sheet_id: 5 } as any);
  });

  describe('addDetailsIncremental', () => {
    beforeEach(() => {
      prisma.route_sheet.findUnique.mockResolvedValue({
        route_sheet_id: 5,
        is_active: true,
        delivery_date: new Date('2026-10-20T00:00:00.000Z'),
        execution_status: 'IN_PROGRESS',
      });
      prisma.order_header.findMany.mockImplementation((args: any) =>
        Promise.resolve(
          ((args?.where?.order_id?.in ?? []) as number[]).map((order_id) => ({
            order_id,
          })),
        ),
      );
    });

    it('agrega solo las paradas nuevas y continúa la secuencia existente', async () => {
      prisma.route_sheet_detail.findMany.mockResolvedValue([{ order_id: 11 }]);
      prisma.route_sheet_detail.findFirst.mockResolvedValue(null);
      prisma.route_sheet_detail.aggregate.mockResolvedValue({
        _max: { sequence_number: 3 },
      });
      prisma.route_sheet_detail.create.mockResolvedValue({});

      await service.addDetailsIncremental(5, {
        details: [
          { order_id: 11, order_type: 'CONTRACT_DELIVERY' as any },
          { order_id: 12, order_type: 'CONTRACT_DELIVERY' as any },
        ],
      });

      expect(prisma.route_sheet_detail.create).toHaveBeenCalledTimes(1);
      expect(prisma.route_sheet_detail.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          route_sheet_id: 5,
          order_id: 12,
          delivery_status: 'PENDING',
          sequence_number: 4,
        }),
      });
      expect(prisma.order_header.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ order_id: { in: [12] } }),
        data: { status: 'READY_FOR_DELIVERY' },
      });
    });

    it('no vuelve a escribir cuando todas las paradas ya están en la hoja', async () => {
      prisma.route_sheet_detail.findMany.mockResolvedValue([{ order_id: 11 }]);
      prisma.route_sheet_detail.aggregate.mockResolvedValue({
        _max: { sequence_number: 3 },
      });

      await service.addDetailsIncremental(5, {
        details: [{ order_id: 11, order_type: 'CONTRACT_DELIVERY' as any }],
      });

      expect(prisma.route_sheet_detail.create).not.toHaveBeenCalled();
      expect(prisma.order_header.updateMany).not.toHaveBeenCalled();
    });

    it('rechaza una parada ya asignada a otra hoja activa de la misma fecha', async () => {
      prisma.route_sheet_detail.findMany.mockResolvedValue([]);
      prisma.route_sheet_detail.findFirst.mockResolvedValue({
        route_sheet_id: 8,
      });
      prisma.route_sheet_detail.aggregate.mockResolvedValue({
        _max: { sequence_number: 0 },
      });

      await expect(
        service.addDetailsIncremental(5, {
          details: [{ order_id: 12, order_type: 'CONTRACT_DELIVERY' as any }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.route_sheet_detail.create).not.toHaveBeenCalled();
    });

    it('rechaza agregar paradas a una hoja cerrada', async () => {
      prisma.route_sheet.findUnique.mockResolvedValue({
        route_sheet_id: 5,
        is_active: true,
        delivery_date: new Date('2026-10-20T00:00:00.000Z'),
        execution_status: 'CLOSED',
      });

      await expect(
        service.addDetailsIncremental(5, {
          details: [{ order_id: 12, order_type: 'CONTRACT_DELIVERY' as any }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza una hoja inexistente o inactiva', async () => {
      prisma.route_sheet.findUnique.mockResolvedValue(null);

      await expect(
        service.addDetailsIncremental(5, {
          details: [{ order_id: 12, order_type: 'CONTRACT_DELIVERY' as any }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza pedidos que no existen', async () => {
      prisma.order_header.findMany.mockResolvedValue([]);

      await expect(
        service.addDetailsIncremental(5, {
          details: [{ order_id: 12, order_type: 'CONTRACT_DELIVERY' as any }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('rescheduleDelivery', () => {
    const payload = {
      reschedule_date: '2026-10-25',
      reason: SkipDeliveryReason.CLIENT_ABSENT,
      notes: 'El cliente pidió pasar el jueves',
    };

    it('marca la parada original como no entregada y crea la parada destino', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(detailRow());
      prisma.route_sheet_detail.updateMany.mockResolvedValue({ count: 1 });
      prisma.route_sheet.findFirst.mockResolvedValue({ route_sheet_id: 42 });
      prisma.route_sheet_detail.findFirst.mockResolvedValue(null);
      prisma.route_sheet_detail.create.mockResolvedValue({
        route_sheet_detail_id: 315,
      });
      prisma.delivery_incident.create.mockResolvedValue({});
      prisma.order_header.update.mockResolvedValue({});

      const result = await service.rescheduleDelivery(101, payload as any, 9);

      expect(result).toEqual({
        detail_id: 101,
        reschedule_date: '2026-10-25',
        target_route_sheet_id: 42,
        target_detail_id: 315,
        idempotent_replay: false,
      });
      expect(prisma.route_sheet_detail.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          route_sheet_detail_id: 101,
          reschedule_date: null,
        }),
        data: expect.objectContaining({
          delivery_status: 'FAILED',
          rejection_reason: SkipDeliveryReason.CLIENT_ABSENT,
        }),
      });
      expect(prisma.delivery_incident.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          incident_type: 'DELIVERY_RESCHEDULED',
          created_by: 9,
          status: 'CLOSED',
        }),
      });
      expect(prisma.order_header.update).toHaveBeenCalledWith({
        where: { order_id: 77 },
        data: { scheduled_delivery_date: expect.any(Date) },
      });
    });

    it('crea la hoja destino cuando no existe para la nueva fecha', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(detailRow());
      prisma.route_sheet_detail.updateMany.mockResolvedValue({ count: 1 });
      prisma.route_sheet.findFirst.mockResolvedValue(null);
      prisma.route_sheet.create.mockResolvedValue({ route_sheet_id: 51 });
      prisma.route_sheet_detail.findFirst.mockResolvedValue(null);
      prisma.route_sheet_detail.create.mockResolvedValue({
        route_sheet_detail_id: 400,
      });

      const result = await service.rescheduleDelivery(101, payload as any, 9);

      expect(prisma.route_sheet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          driver_id: DRIVER_ID,
          vehicle_id: VEHICLE_ID,
          delivery_date: expect.any(Date),
        }),
        select: { route_sheet_id: true },
      });
      expect(result.target_route_sheet_id).toBe(51);
      expect(result.target_detail_id).toBe(400);
    });

    it('reutiliza la parada destino si ya existe (no la duplica)', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(detailRow());
      prisma.route_sheet_detail.updateMany.mockResolvedValue({ count: 1 });
      prisma.route_sheet.findFirst.mockResolvedValue({ route_sheet_id: 42 });
      prisma.route_sheet_detail.findFirst.mockResolvedValue({
        route_sheet_detail_id: 900,
      });

      const result = await service.rescheduleDelivery(101, payload as any, 9);

      expect(prisma.route_sheet_detail.create).not.toHaveBeenCalled();
      expect(result.target_detail_id).toBe(900);
    });

    it('no vuelve a aplicar efectos si la parada ya fue reprogramada', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(
        detailRow({ reschedule_date: new Date('2026-10-25T03:00:00.000Z') }),
      );

      const result = await service.rescheduleDelivery(101, payload as any, 9);

      expect(result).toEqual({
        detail_id: 101,
        reschedule_date: '2026-10-25',
        target_route_sheet_id: null,
        target_detail_id: null,
        idempotent_replay: true,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza reprogramar una entrega ya completada', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(
        detailRow({ delivery_status: 'DELIVERED' }),
      );

      await expect(
        service.rescheduleDelivery(101, payload as any, 9),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza la misma fecha que la hoja actual', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(detailRow());

      await expect(
        service.rescheduleDelivery(
          101,
          { ...payload, reschedule_date: '2026-10-20' } as any,
          9,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza un detalle inexistente', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(null);

      await expect(
        service.rescheduleDelivery(999, payload as any, 9),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('forwardDeliveryToAdmin', () => {
    const payload = {
      reason: SkipDeliveryReason.WRONG_ADDRESS,
      notes: 'La dirección no existe',
    };

    it('marca la parada como omitida y deja un incidente abierto', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(detailRow());
      prisma.route_sheet_detail.updateMany.mockResolvedValue({ count: 1 });
      prisma.delivery_incident.create.mockResolvedValue({});

      const result = await service.forwardDeliveryToAdmin(
        101,
        payload as any,
        9,
      );

      expect(result).toEqual({ detail_id: 101, idempotent_replay: false });
      expect(prisma.route_sheet_detail.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ route_sheet_detail_id: 101 }),
        data: expect.objectContaining({
          delivery_status: 'SKIPPED',
          rejection_reason: SkipDeliveryReason.WRONG_ADDRESS,
        }),
      });
      expect(prisma.delivery_incident.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          incident_type: 'FORWARDED_TO_ADMIN',
          created_by: 9,
          status: 'OPEN',
        }),
      });
    });

    it('es idempotente si la parada ya estaba derivada', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(
        detailRow({ delivery_status: 'SKIPPED' }),
      );

      const result = await service.forwardDeliveryToAdmin(
        101,
        payload as any,
        9,
      );

      expect(result).toEqual({ detail_id: 101, idempotent_replay: true });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rechaza derivar una entrega ya completada', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue(
        detailRow({ delivery_status: 'DELIVERED' }),
      );

      await expect(
        service.forwardDeliveryToAdmin(101, payload as any, 9),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
