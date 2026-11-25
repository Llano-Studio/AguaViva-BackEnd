import { PrismaClient } from '@prisma/client';
import {
  GeocodeCandidate,
  buildQuery,
  resolveShortLink,
  runGeocodeBatch,
  toCsv,
} from './geocode-batch';
import { readServiceArea } from './geo.rules';
import { GeocodeResult } from './google-geocoder';

const area = readServiceArea(undefined);

function setup(results: GeocodeResult[] = []) {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma = { person: { updateMany } } as unknown as PrismaClient;
  const geocode = jest.fn<Promise<GeocodeResult>, [string]>();
  results.forEach((r) => geocode.mockResolvedValueOnce(r));
  return { prisma, updateMany, geocoder: { geocode } };
}

const candidate = (
  overrides: Partial<GeocodeCandidate> = {},
): GeocodeCandidate => ({
  person_id: 10,
  address: 'Av. Sarmiento 1234',
  locality: 'Resistencia',
  province: 'Chaco',
  ...overrides,
});
const opts = { apply: true, includeApproximate: false, delayMs: 0 };

describe('runGeocodeBatch', () => {
  it('arma la consulta con dirección, localidad, provincia y país', () => {
    expect(buildQuery(candidate())).toBe(
      'Av. Sarmiento 1234, Resistencia, Chaco, Argentina',
    );
  });

  it('usa el link de Google Maps del cliente antes que geocodificar', async () => {
    const { prisma, updateMany, geocoder } = setup();
    const { rows } = await runGeocodeBatch(
      prisma,
      geocoder,
      area,
      [
        candidate({
          location_text: 'https://www.google.com/maps/@-27.4512,-58.9867,18z',
        }),
      ],
      opts,
    );
    expect(geocoder.geocode).not.toHaveBeenCalled();
    expect(rows[0]).toMatchObject({
      outcome: 'SAVED',
      source: 'MAPS_LINK',
      precision: 'EXACT',
    });
    const [saved] = updateMany.mock.calls[0] as [Record<string, unknown>];
    expect(saved).toMatchObject({
      where: {
        person_id: 10,
        OR: [{ geo_source: null }, { geo_source: 'GOOGLE_GEOCODING' }],
      },
      data: {
        lat: -27.4512,
        lng: -58.9867,
        geo_source: 'MAPS_LINK',
        geo_precision: 'EXACT',
      },
    });
  });

  it('resuelve un link corto y saca el punto de la URL final', async () => {
    const { prisma, geocoder } = setup();
    const resolveLink = jest
      .fn<Promise<string | null>, [string]>()
      .mockResolvedValue(
        'https://www.google.com/maps/place/X/data=!3d-27.45!4d-58.97',
      );
    const { rows } = await runGeocodeBatch(
      prisma,
      geocoder,
      area,
      [
        candidate({
          location_text: 'ubicación: https://maps.app.goo.gl/AbC123',
        }),
      ],
      opts,
      { resolveLink },
    );
    expect(resolveLink).toHaveBeenCalledWith('https://maps.app.goo.gl/AbC123');
    expect(rows[0]).toMatchObject({
      outcome: 'SAVED',
      lat: -27.45,
      lng: -58.97,
    });
  });

  it('en modo prueba no guarda nada', async () => {
    const { prisma, updateMany, geocoder } = setup([
      { status: 'OK', point: { lat: -27.45, lng: -58.98 }, precision: 'EXACT' },
    ]);
    const { rows } = await runGeocodeBatch(
      prisma,
      geocoder,
      area,
      [candidate()],
      { ...opts, apply: false },
    );
    expect(rows[0].outcome).toBe('FOUND_NOT_SAVED');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('no guarda los aproximados salvo que se pida', async () => {
    const approx: GeocodeResult = {
      status: 'OK',
      point: { lat: -27.45, lng: -58.98 },
      precision: 'APPROXIMATE',
    };
    const a = setup([approx]);
    expect(
      (await runGeocodeBatch(a.prisma, a.geocoder, area, [candidate()], opts))
        .rows[0].outcome,
    ).toBe('APPROXIMATE_SKIPPED');
    const b = setup([approx]);
    expect(
      (
        await runGeocodeBatch(b.prisma, b.geocoder, area, [candidate()], {
          ...opts,
          includeApproximate: true,
        })
      ).rows[0].outcome,
    ).toBe('SAVED');
  });

  it('si el cliente ya tiene un punto mejor, no lo pisa', async () => {
    const { prisma, updateMany, geocoder } = setup([
      { status: 'OK', point: { lat: -27.45, lng: -58.98 }, precision: 'EXACT' },
    ]);
    updateMany.mockResolvedValue({ count: 0 });
    const { rows } = await runGeocodeBatch(
      prisma,
      geocoder,
      area,
      [candidate()],
      opts,
    );
    expect(rows[0].outcome).toBe('ALREADY_LOCATED');
  });

  it('sin dirección no consulta a Google', async () => {
    const { prisma, geocoder } = setup();
    const { rows } = await runGeocodeBatch(
      prisma,
      geocoder,
      area,
      [candidate({ address: '  ' })],
      opts,
    );
    expect(rows[0].outcome).toBe('NO_ADDRESS');
    expect(geocoder.geocode).not.toHaveBeenCalled();
  });

  it('corta todo si Google rechaza la key o se agota la cuota', async () => {
    const { prisma, geocoder } = setup([
      { status: 'OK', point: { lat: -27.45, lng: -58.98 }, precision: 'EXACT' },
      { status: 'DENIED', detail: 'API key not authorized' },
    ]);
    const { rows, aborted } = await runGeocodeBatch(
      prisma,
      geocoder,
      area,
      [
        candidate({ person_id: 1 }),
        candidate({ person_id: 2 }),
        candidate({ person_id: 3 }),
      ],
      opts,
    );
    expect(rows).toHaveLength(1);
    expect(aborted).toContain('DENIED');
    expect(geocoder.geocode).toHaveBeenCalledTimes(2);
  });

  it('el reporte CSV escapa comas y comillas', () => {
    const csv = toCsv([
      {
        person_id: 1,
        query: 'Calle "A", 12',
        source: 'GOOGLE_GEOCODING',
        outcome: 'SAVED',
        precision: 'EXACT',
        lat: -27.4,
        lng: -58.9,
        formatted_address: 'x',
        detail: '',
      },
    ]);
    expect(csv.split('\n')[1]).toBe(
      '1,SAVED,GOOGLE_GEOCODING,EXACT,-27.4,-58.9,"Calle ""A"", 12",x,',
    );
  });
});

describe('resolveShortLink', () => {
  it('sigue las redirecciones hasta una URL con coordenadas', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      status: 302,
      headers: { get: () => 'https://maps.google.com/?q=-27.45,-58.98' },
    });
    expect(await resolveShortLink('https://maps.app.goo.gl/x', fetchMock)).toBe(
      'https://maps.google.com/?q=-27.45,-58.98',
    );
  });

  it('si no redirige, devuelve null', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ status: 404, headers: { get: () => null } });
    expect(
      await resolveShortLink('https://maps.app.goo.gl/x', fetchMock),
    ).toBeNull();
  });
});
