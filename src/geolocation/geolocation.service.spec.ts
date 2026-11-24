import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GeolocationService, customerCoordinates } from './geolocation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GeolocationService', () => {
  let prisma: {
    person: {
      update: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    route_sheet_detail: { findUnique: jest.Mock; update: jest.Mock };
  };
  let service: GeolocationService;

  beforeEach(() => {
    prisma = {
      person: {
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      route_sheet_detail: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ order_header: { customer_id: 77 } }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new GeolocationService(prisma as unknown as PrismaService);
  });

  describe('setManualLocation', () => {
    it('guarda el punto como ADMIN exacto', async () => {
      prisma.person.update.mockResolvedValue({
        person_id: 5,
        lat: new Prisma.Decimal('-27.4512'),
        lng: new Prisma.Decimal('-58.9867'),
        geo_source: 'ADMIN',
        geo_precision: 'EXACT',
        geo_updated_at: new Date('2026-11-25T13:00:00Z'),
      });
      const dto = await service.setManualLocation(5, {
        lat: -27.4512,
        lng: -58.9867,
      });
      const [args] = prisma.person.update.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(args.data).toMatchObject({
        lat: -27.4512,
        lng: -58.9867,
        geo_source: 'ADMIN',
        geo_precision: 'EXACT',
      });
      expect(dto).toMatchObject({
        person_id: 5,
        lat: -27.4512,
        lng: -58.9867,
        source: 'ADMIN',
      });
      expect(dto.navigation_url).toContain('destination=-27.4512,-58.9867');
    });

    it('rechaza un punto fuera de la zona (por ejemplo, lat y lng invertidas)', async () => {
      await expect(
        service.setManualLocation(5, { lat: -58.98, lng: -27.45 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.person.update).not.toHaveBeenCalled();
    });

    it('cliente inexistente → 404', async () => {
      prisma.person.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('no existe', {
          code: 'P2025',
          clientVersion: 'x',
        }),
      );
      await expect(
        service.setManualLocation(5, { lat: -27.45, lng: -58.98 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('captureFromDriver', () => {
    const gps = { lat: -27.4512, lng: -58.9867, accuracy_m: 8 };

    it('ubica al cliente solo si no tenía punto o lo tenía impreciso', async () => {
      expect(await service.captureFromDriver(900, gps)).toEqual({
        applied: true,
      });
      const [args] = prisma.person.updateMany.mock.calls[0] as [
        { where: unknown; data: Record<string, unknown> },
      ];
      expect(args.where).toEqual({
        person_id: 77,
        OR: [
          { geo_source: null },
          {
            geo_source: 'GOOGLE_GEOCODING',
            geo_precision: { in: ['INTERPOLATED', 'APPROXIMATE'] },
          },
        ],
      });
      expect(args.data).toMatchObject({
        geo_source: 'DRIVER_GPS',
        geo_precision: 'EXACT',
      });
      expect(prisma.route_sheet_detail.update).toHaveBeenCalledWith({
        where: { route_sheet_detail_id: 900 },
        data: { lat: -27.4512, lng: -58.9867 },
      });
    });

    it('si el cliente ya tenía un punto bueno, no lo pisa', async () => {
      prisma.person.updateMany.mockResolvedValue({ count: 0 });
      expect(await service.captureFromDriver(900, gps)).toEqual({
        applied: false,
        reason: 'ALREADY_LOCATED',
      });
    });

    it('ignora un GPS impreciso o fuera de la zona', async () => {
      expect(
        await service.captureFromDriver(900, { ...gps, accuracy_m: 120 }),
      ).toEqual({ applied: false, reason: 'LOW_ACCURACY' });
      expect(
        await service.captureFromDriver(900, { lat: -34.6, lng: -58.38 }),
      ).toEqual({ applied: false, reason: 'OUT_OF_AREA' });
      expect(await service.captureFromDriver(900, undefined)).toEqual({
        applied: false,
        reason: 'NO_LOCATION',
      });
      expect(prisma.person.updateMany).not.toHaveBeenCalled();
    });

    it('una parada sin cliente (cobranza) no ubica a nadie', async () => {
      prisma.route_sheet_detail.findUnique.mockResolvedValue({
        order_header: null,
      });
      expect(await service.captureFromDriver(900, gps)).toEqual({
        applied: false,
        reason: 'NO_CUSTOMER',
      });
    });
  });

  describe('listPending', () => {
    it('lista activos sin punto o aproximados, con la cobertura', async () => {
      prisma.person.findMany.mockResolvedValue([
        {
          person_id: 1,
          name: 'A',
          address: 'Calle 1',
          lat: null,
          lng: null,
          geo_source: null,
          geo_precision: null,
          geo_updated_at: null,
          locality: { name: 'Resistencia' },
          zone: { name: 'Centro' },
        },
        {
          person_id: 2,
          name: 'B',
          address: 'B° Golf Mz 5',
          lat: new Prisma.Decimal('-27.45'),
          lng: new Prisma.Decimal('-58.98'),
          geo_source: 'GOOGLE_GEOCODING',
          geo_precision: 'APPROXIMATE',
          geo_updated_at: null,
          locality: null,
          zone: null,
        },
      ]);
      prisma.person.count
        .mockResolvedValueOnce(2) // total del filtro
        .mockResolvedValueOnce(100) // activos
        .mockResolvedValueOnce(20) // sin punto
        .mockResolvedValueOnce(10); // aproximados

      const result = await service.listPending({});

      expect(result.coverage).toEqual({
        total: 100,
        located: 70,
        approximate: 10,
        missing: 20,
      });
      expect(result.data.map((d) => [d.person_id, d.reason])).toEqual([
        [1, 'MISSING'],
        [2, 'APPROXIMATE'],
      ]);
      const [args] = prisma.person.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ];
      expect(args.where).toMatchObject({ is_active: true });
    });
  });

  it('customerCoordinates arma las coordenadas y el link, o null', () => {
    expect(customerCoordinates(null)).toEqual({
      coordinates: null,
      navigation_url: null,
    });
    expect(customerCoordinates({ lat: null, lng: null })).toEqual({
      coordinates: null,
      navigation_url: null,
    });
    expect(
      customerCoordinates({
        lat: -27.45,
        lng: -58.98,
        geo_source: 'ADMIN',
        geo_precision: 'EXACT',
      }),
    ).toEqual({
      coordinates: {
        lat: -27.45,
        lng: -58.98,
        source: 'ADMIN',
        precision: 'EXACT',
      },
      navigation_url:
        'https://www.google.com/maps/dir/?api=1&destination=-27.45,-58.98',
    });
  });
});
