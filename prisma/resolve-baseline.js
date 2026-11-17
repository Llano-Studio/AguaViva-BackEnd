// Marca la migración baseline como aplicada en bases que ya tenían el esquema
// (creado antes de versionar las migraciones). En una base vacía no hace nada
// y `prisma migrate deploy` crea todo desde la baseline.
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const BASELINE = '20260101000000_baseline';

async function main() {
  const prisma = new PrismaClient();
  try {
    const [{ has_schema }] = await prisma.$queryRaw`
      SELECT to_regclass('public.person') IS NOT NULL AS has_schema`;
    if (!has_schema) return;

    const [{ has_history }] = await prisma.$queryRaw`
      SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS has_history`;
    if (has_history) {
      const rows = await prisma.$queryRaw`
        SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${BASELINE} LIMIT 1`;
      if (rows.length > 0) return;
    }

    console.log(`⏳ Marcando ${BASELINE} como aplicada (esquema existente)...`);
    execSync(`npx prisma migrate resolve --applied ${BASELINE}`, {
      stdio: 'inherit',
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
