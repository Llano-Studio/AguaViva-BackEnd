import { Prisma, PrismaClient } from '@prisma/client';

const ACCENTED_CHARS = 'áàäâãéèëêíìïîóòöôõúùüûÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛ';
const PLAIN_CHARS = 'aaaaaeeeeiiiiooooouuuuaaaaaeeeeiiiiooooouuuu';

/**
 * Normaliza un texto para búsquedas tolerantes: minúsculas, sin tildes y sin
 * espacios. La "ñ" se conserva porque es una letra distinta.
 */
export function normalizeSearchText(value: string): string {
  let result = value.toLowerCase();
  for (let i = 0; i < ACCENTED_CHARS.length; i++) {
    result = result.split(ACCENTED_CHARS[i]).join(PLAIN_CHARS[i]);
  }
  return result.replace(/\s+/g, '');
}

/**
 * Expresión SQL equivalente a normalizeSearchText para una columna.
 * Usa solo funciones nativas de PostgreSQL (no requiere la extensión unaccent).
 * `column` debe ser un identificador fijo del código, nunca input del usuario.
 */
export function normalizedColumnSql(column: string): Prisma.Sql {
  return Prisma.sql`regexp_replace(translate(lower(${Prisma.raw(column)}), ${ACCENTED_CHARS}, ${PLAIN_CHARS}), '\\s+', '', 'g')`;
}

/** Escapa los comodines de LIKE (%, _ y \) para buscar el texto literal. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Busca ids en una tabla cuyas columnas contienen `term` ignorando mayúsculas,
 * tildes y espacios. `table`, `idColumn` y `columns` deben ser identificadores
 * fijos del código (nunca input del usuario). Los valores no-texto (enums) se
 * castean a text.
 */
export async function findIdsByNormalizedText(
  prisma: { $queryRaw: PrismaClient['$queryRaw'] },
  params: {
    table: string;
    idColumn: string;
    columns: string[];
    term: string;
  },
): Promise<number[]> {
  const normalized = normalizeSearchText(params.term);
  if (!normalized || params.columns.length === 0) return [];

  const pattern = `%${escapeLikePattern(normalized)}%`;
  const conditions = params.columns.map(
    (column) =>
      Prisma.sql`${normalizedColumnSql(`"${column}"::text`)} LIKE ${pattern}`,
  );

  const rows = await prisma.$queryRaw<Array<{ id: number }>>(
    Prisma.sql`SELECT ${Prisma.raw(`"${params.idColumn}"`)} AS id FROM ${Prisma.raw(`"${params.table}"`)} WHERE ${Prisma.join(conditions, ' OR ')}`,
  );
  return rows.map((row) => Number(row.id));
}
