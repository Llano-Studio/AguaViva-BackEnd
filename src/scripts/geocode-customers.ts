/**
 * Ubica en forma masiva a los clientes sin coordenadas (AguaViva).
 *
 * Por defecto NO guarda nada: genera un reporte CSV para revisar. Con --apply
 * guarda los puntos exactos e interpolados (los aproximados solo con
 * --include-approximate). Nunca pisa un punto de administración, de un link de
 * Google Maps ni del GPS del chofer.
 *
 * Uso (dentro del contenedor del backend):
 *   node dist/src/scripts/geocode-customers.js [--apply] [--limit N]
 *        [--include-approximate] [--retry-approximate] [--report ruta.csv]
 * Necesita GOOGLE_GEOCODING_API_KEY en el entorno.
 */
import { writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import {
  GEO_PRECISION,
  GEO_SOURCE,
  readServiceArea,
} from '../geolocation/geo.rules';
import { GoogleGeocoder } from '../geolocation/google-geocoder';
import {
  BatchOutcome,
  runGeocodeBatch,
  toCsv,
} from '../geolocation/geocode-batch';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(name);

async function main() {
  const apply = flag('--apply');
  const limit = Number(arg('--limit')) || undefined;
  const report =
    arg('--report') ??
    `/tmp/geocode-clientes-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  const area = readServiceArea(process.env.GEO_SERVICE_AREA_BBOX);
  const key = process.env.GOOGLE_GEOCODING_API_KEY?.trim();
  const geocoder = key ? new GoogleGeocoder(key, area) : null;

  const prisma = new PrismaClient();
  try {
    const persons = await prisma.person.findMany({
      where: {
        is_active: true,
        ...(flag('--retry-approximate')
          ? {
              geo_source: GEO_SOURCE.GOOGLE_GEOCODING,
              geo_precision: GEO_PRECISION.APPROXIMATE,
            }
          : { lat: null }),
      },
      orderBy: { person_id: 'asc' },
      take: limit,
      select: {
        person_id: true,
        address: true,
        locality: {
          select: { name: true, province: { select: { name: true } } },
        },
      },
    });
    console.log(
      `${persons.length} clientes para ubicar (${apply ? 'GUARDANDO' : 'modo prueba, no guarda'}).`,
    );
    if (!geocoder)
      console.log(
        'Sin GOOGLE_GEOCODING_API_KEY: solo se reportan, no se geocodifican.',
      );

    const { rows, aborted } = await runGeocodeBatch(
      prisma,
      geocoder,
      area,
      persons.map((p) => ({
        person_id: p.person_id,
        address: p.address,
        locality: p.locality?.name ?? null,
        province: p.locality?.province?.name ?? null,
      })),
      {
        apply,
        includeApproximate: flag('--include-approximate'),
        delayMs: 100,
      },
      { log: (m) => console.log(m) },
    );

    writeFileSync(report, toCsv(rows), 'utf8');
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
      return acc;
    }, {});
    const summary: Partial<Record<BatchOutcome, number>> = counts;
    console.log('Resultado:', JSON.stringify(summary));
    console.log(`Reporte: ${report}`);
    if (aborted) {
      console.error(`Cortado antes de terminar: ${aborted}`);
      process.exitCode = 2;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
