import { existsSync } from 'fs';
import { join } from 'path';
import { webcrypto } from 'crypto';
import { config } from 'dotenv';

/**
 * Prepara el entorno de las pruebas de integración y HTTP.
 *
 * Las pruebas corren contra una base *_test (ver test/helpers/test-db.ts).
 * La conexión se toma de `TEST_DATABASE_URL`; si no está definida, se lee de
 * `test/.env.test`, un archivo local que no se versiona.
 */
const envFile = join(__dirname, '.env.test');
if (existsSync(envFile)) {
  config({ path: envFile });
}

/** Sufijo exigido para no apuntar por error a datos productivos. */
const REQUIRED_DATABASE_SUFFIX = '_test';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (testDatabaseUrl) {
  const database = new URL(testDatabaseUrl).pathname.replace(/^\//, '');
  if (!database.endsWith(REQUIRED_DATABASE_SUFFIX)) {
    throw new Error(
      `Las pruebas de integración solo corren contra una base terminada en ` +
        `"${REQUIRED_DATABASE_SUFFIX}" (recibida: "${database}").`,
    );
  }
  // La aplicación se conecta leyendo DATABASE_URL.
  process.env.DATABASE_URL = testDatabaseUrl;
}

// Las pruebas firman los JWT con el mismo secreto con el que la app los valida.
process.env.JWT_SECRET ??= 'sgarav-e2e-secret';
process.env.TZ ??= 'America/Argentina/Buenos_Aires';

// Node 18 no expone `crypto` como global y @nestjs/schedule lo necesita al
// registrar los cron jobs.
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto;
}
