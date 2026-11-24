import {
  GEO_PRECISION,
  GEO_SOURCE,
  isInsideArea,
  isShortMapsLink,
  locationRank,
  navigationUrl,
  parseCoordinatesFromText,
  readServiceArea,
} from './geo.rules';

describe('geo.rules', () => {
  const area = readServiceArea(undefined);

  it('lee la zona por defecto y rechaza una mal escrita', () => {
    expect(area).toEqual({
      west: -59.15,
      south: -27.62,
      east: -58.65,
      north: -27.3,
    });
    expect(() => readServiceArea('-58,-27,-59,-28')).toThrow();
    expect(() => readServiceArea('a,b,c,d')).toThrow();
  });

  it('distingue puntos dentro y fuera de la zona', () => {
    expect(isInsideArea({ lat: -27.4512, lng: -58.9867 }, area)).toBe(true); // Resistencia
    expect(isInsideArea({ lat: -27.4692, lng: -58.8341 }, area)).toBe(true); // Corrientes
    expect(isInsideArea({ lat: -34.6037, lng: -58.3816 }, area)).toBe(false); // Buenos Aires
    expect(isInsideArea({ lat: -58.9867, lng: -27.4512 }, area)).toBe(false); // invertidas
  });

  it.each([
    [
      'https://www.google.com/maps/place/X/@-27.4512,-58.9867,17z/data=!3d-27.45133!4d-58.98701',
      -27.45133,
      -58.98701,
    ],
    [
      'https://www.google.com/maps/@-27.4512345,-58.9867654,18z',
      -27.4512345,
      -58.9867654,
    ],
    ['https://maps.google.com/?q=-27.4512,-58.9867', -27.4512, -58.9867],
    [
      'https://www.google.com/maps/search/?api=1&query=-27.46,-58.98',
      -27.46,
      -58.98,
    ],
    ['-27.451234, -58.986765', -27.451234, -58.986765],
  ])('saca las coordenadas de %s', (text, lat, lng) => {
    expect(parseCoordinatesFromText(text)).toEqual({ lat, lng });
  });

  it('no inventa coordenadas de un texto sin ellas', () => {
    expect(parseCoordinatesFromText('Av. Sarmiento 1234')).toBeNull();
    expect(
      parseCoordinatesFromText('https://maps.app.goo.gl/AbCdEf'),
    ).toBeNull();
    expect(parseCoordinatesFromText(null)).toBeNull();
  });

  it('reconoce los links cortos de Google Maps', () => {
    expect(isShortMapsLink('ver https://maps.app.goo.gl/AbCdEf123')).toBe(true);
    expect(isShortMapsLink('https://goo.gl/maps/AbCdEf')).toBe(true);
    expect(
      isShortMapsLink('https://www.google.com/maps/@-27.4,-58.9,17z'),
    ).toBe(false);
  });

  it('ordena las fuentes: administración > link > Google exacta > GPS > interpolada > aproximada', () => {
    const ranks = [
      locationRank(GEO_SOURCE.ADMIN, GEO_PRECISION.EXACT),
      locationRank(GEO_SOURCE.MAPS_LINK, GEO_PRECISION.EXACT),
      locationRank(GEO_SOURCE.GOOGLE_GEOCODING, GEO_PRECISION.EXACT),
      locationRank(GEO_SOURCE.DRIVER_GPS, GEO_PRECISION.EXACT),
      locationRank(GEO_SOURCE.GOOGLE_GEOCODING, GEO_PRECISION.INTERPOLATED),
      locationRank(GEO_SOURCE.GOOGLE_GEOCODING, GEO_PRECISION.APPROXIMATE),
      locationRank(null, null),
    ];
    expect([...ranks].sort((a, b) => b - a)).toEqual(ranks);
  });

  it('arma el link de navegación', () => {
    expect(navigationUrl({ lat: -27.45, lng: -58.98 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=-27.45,-58.98',
    );
  });
});
