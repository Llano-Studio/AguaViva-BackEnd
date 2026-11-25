import { GoogleGeocoder, toPrecision } from './google-geocoder';
import { readServiceArea } from './geo.rules';

const area = readServiceArea(undefined);

function geocoderWith(body: unknown) {
  const fetchMock = jest
    .fn<
      Promise<{ status: number; json(): Promise<unknown> }>,
      [string, { signal?: AbortSignal }?]
    >()
    .mockResolvedValue({ status: 200, json: () => Promise.resolve(body) });
  return { geocoder: new GoogleGeocoder('clave', area, fetchMock), fetchMock };
}

const result = (
  location: { lat: number; lng: number },
  type: string,
  extra = {},
) => ({
  status: 'OK',
  results: [
    {
      formatted_address: 'Av. Sarmiento 1234, Resistencia, Chaco',
      geometry: { location, location_type: type },
      ...extra,
    },
  ],
});

describe('GoogleGeocoder', () => {
  it('pide solo Argentina, prioriza la zona y manda la key', async () => {
    const { geocoder, fetchMock } = geocoderWith(
      result({ lat: -27.45, lng: -58.98 }, 'ROOFTOP'),
    );
    await geocoder.geocode('Av. Sarmiento 1234, Resistencia, Chaco, Argentina');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('components')).toBe('country:AR');
    expect(url.searchParams.get('bounds')).toBe('-27.62,-59.15|-27.3,-58.65');
    expect(url.searchParams.get('key')).toBe('clave');
  });

  it('una casa exacta queda EXACT', async () => {
    const { geocoder } = geocoderWith(
      result({ lat: -27.45, lng: -58.98 }, 'ROOFTOP'),
    );
    expect(await geocoder.geocode('x')).toMatchObject({
      status: 'OK',
      precision: 'EXACT',
      point: { lat: -27.45, lng: -58.98 },
    });
  });

  it('una coincidencia parcial queda APPROXIMATE aunque sea ROOFTOP', async () => {
    const { geocoder } = geocoderWith(
      result({ lat: -27.45, lng: -58.98 }, 'ROOFTOP', { partial_match: true }),
    );
    expect((await geocoder.geocode('x')).precision).toBe('APPROXIMATE');
  });

  it('descarta un resultado fuera de la zona', async () => {
    const { geocoder } = geocoderWith(
      result({ lat: -34.6, lng: -58.38 }, 'ROOFTOP'),
    );
    expect((await geocoder.geocode('x')).status).toBe('OUT_OF_AREA');
  });

  it.each([
    ['ZERO_RESULTS', 'NOT_FOUND'],
    ['OVER_QUERY_LIMIT', 'QUOTA_EXCEEDED'],
    ['REQUEST_DENIED', 'DENIED'],
    ['INVALID_REQUEST', 'ERROR'],
  ])('Google %s → %s', async (googleStatus, expected) => {
    const { geocoder } = geocoderWith({ status: googleStatus });
    expect((await geocoder.geocode('x')).status).toBe(expected);
  });

  it('un error de red no rompe: devuelve ERROR', async () => {
    const geocoder = new GoogleGeocoder('clave', area, () =>
      Promise.reject(new Error('ECONNRESET')),
    );
    expect(await geocoder.geocode('x')).toEqual({
      status: 'ERROR',
      detail: 'ECONNRESET',
    });
  });

  it('traduce el tipo de ubicación a precisión', () => {
    expect(toPrecision('ROOFTOP')).toBe('EXACT');
    expect(toPrecision('RANGE_INTERPOLATED')).toBe('INTERPOLATED');
    expect(toPrecision('GEOMETRIC_CENTER')).toBe('APPROXIMATE');
    expect(toPrecision('APPROXIMATE')).toBe('APPROXIMATE');
  });
});
