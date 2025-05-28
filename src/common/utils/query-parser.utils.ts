/**
 * Parsea un string de ordenamiento (sortBy) y devuelve un array de objetos
 * para la cláusula `orderBy` de Prisma.
 *
 * @param sortBy - String de ordenamiento, ej: "name,-createdAt,relation.field".
 * @param defaultOrderBy - Cláusula orderBy por defecto si sortBy no se proporciona o está vacío.
 * @returns Un array para la cláusula orderBy de Prisma, o undefined si no hay ordenamiento aplicable.
 */
export function parseSortByString(
  sortBy?: string,
  defaultOrderBy?: any | any[]
): any[] | undefined {
  let orderByArray: any[] | undefined;

  if (sortBy && sortBy.trim() !== '') {
    orderByArray = sortBy.split(',')
      .map(field => field.trim()) // Limpiar espacios alrededor de cada campo
      .filter(trimmedField => trimmedField !== '') // Ignorar campos vacíos si la coma es doble, ej: "name,,"
      .map(trimmedField => {
        const direction = trimmedField.startsWith('-') ? 'desc' : 'asc';
        const fieldName = trimmedField.startsWith('-') ? trimmedField.substring(1) : trimmedField;

        if (fieldName.includes('.')) {
          const parts = fieldName.split('.');
          // Asume un solo nivel de anidamiento: { relation: { field: direction } }
          // Esto es consistente con el código original que has mostrado.
          if (parts.length === 2 && parts[0] && parts[1]) {
            return { [parts[0]]: { [parts[1]]: direction } };
          }
          // Si el formato no es "relation.field" (ej. "a.b.c" o ".field" o "relation."),
          // se tratará como un campo literal con puntos. Prisma lo manejará como un nombre de campo.
          return { [fieldName]: direction };
        } else {
          return { [fieldName]: direction };
        }
      });
  }

  // Si se parseó un orderByArray y tiene elementos, usarlo.
  if (orderByArray && orderByArray.length > 0) {
    return orderByArray;
  }

  // Si no, y hay un defaultOrderBy, usar el default.
  if (defaultOrderBy) {
    return Array.isArray(defaultOrderBy) ? defaultOrderBy : [defaultOrderBy];
  }

  // Si no hay sortBy ni defaultOrderBy, devolver undefined para que Prisma use su ordenamiento por defecto.
  return undefined;
} 