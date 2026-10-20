import { PrismaClient } from '@prisma/client';

/** Nombre de base exigido: evita apuntar por error a datos productivos. */
const REQUIRED_DATABASE_SUFFIX = '_test';

export function getTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      'Falta TEST_DATABASE_URL. Definila en el entorno o en test/.env.test ' +
        'con la cadena de conexión a la base de pruebas.',
    );
  }

  const database = new URL(url).pathname.replace(/^\//, '');
  if (!database.endsWith(REQUIRED_DATABASE_SUFFIX)) {
    throw new Error(
      `Las pruebas de integración solo corren contra una base terminada en ` +
        `"${REQUIRED_DATABASE_SUFFIX}" (recibida: "${database}").`,
    );
  }

  return url;
}

export function createTestPrisma(): PrismaClient {
  return new PrismaClient({ datasourceUrl: getTestDatabaseUrl() });
}
