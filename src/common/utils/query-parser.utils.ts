function getMappedField(
  fieldMappings: Record<string, string>,
  field: string,
): string | undefined {
  if (Object.prototype.hasOwnProperty.call(fieldMappings, field)) {
    return fieldMappings[field];
  }

  return field;
}

/**
 * Mapea campos de ordenamiento a su ruta real en Prisma para órdenes híbridas
 */
export function mapOrderSortFields(field: string): string {
  const fieldMappings: Record<string, string> = {
    // Campos directos de order_header
    id: 'order_id',
    order_id: 'order_id',
    order_date: 'order_date',
    delivery_date: 'scheduled_delivery_date',
    order_type: 'order_type',
    status: 'status',
    total_amount: 'total_amount',
    paid_amount: 'paid_amount',
    delivery_time: 'delivery_time',
    notes: 'notes',
    zone_id: 'zone_id',
    payment_status: 'payment_status',

    // Campos relacionados del customer (person)
    address: 'customer.address',
    phone: 'customer.phone',
    name: 'customer.name',
    delivery_address: 'customer.address', // order_header NO tiene delivery_address directo
    customer_address: 'customer.address',
    'customer.address': 'customer.address',
    'customer.phone': 'customer.phone',
    'customer.name': 'customer.name',
    customer_id: 'customer_id',
  };

  return getMappedField(fieldMappings, field) ?? field;
}

/**
 * Mapea campos de ordenamiento a su ruta real en Prisma para one-off purchases (legacy)
 */
export function mapOneOffSortFields(field: string): string | undefined {
  const fieldMappings: Record<string, string> = {
    // Campos directos de one_off_purchase
    id: 'purchase_id',
    purchase_id: 'purchase_id',
    person_id: 'person_id',
    product_id: 'product_id',
    quantity: 'quantity',
    total_amount: 'total_amount',
    purchase_date: 'purchase_date',
    order_date: 'purchase_date',
    sale_channel_id: 'sale_channel_id',
    address: 'delivery_address',
    delivery_address: 'delivery_address', // one_off_purchase SÍ tiene delivery_address directo
    locality_id: 'locality_id',
    zone_id: 'zone_id',
    scheduled_delivery_date: 'scheduled_delivery_date',
    delivery_time: 'delivery_time',
    notes: 'notes',
    paid_amount: 'paid_amount',
    price_list_id: 'price_list_id',
    delivered_quantity: 'delivered_quantity',
    requires_delivery: 'requires_delivery',
    returned_quantity: 'returned_quantity',
    status: 'status',
    payment_status: '',

    // Campos relacionados de person
    phone: 'person.phone',
    name: 'person.name',
    'person.address': 'person.address',
    'person.phone': 'person.phone',
    'person.name': 'person.name',
    'customer.address': 'person.address',
    'customer.phone': 'person.phone',
    'customer.name': 'person.name',
    person_address: 'person.address', // Para diferenciar del delivery_address
    order_type: '',
  };

  return getMappedField(fieldMappings, field);
}

/**
 * Mapea campos de ordenamiento a su ruta real en Prisma para one-off purchase headers
 */
export function mapOneOffHeaderSortFields(field: string): string | undefined {
  const fieldMappings: Record<string, string> = {
    // Campos directos de one_off_purchase_header
    id: 'purchase_header_id',
    purchase_id: 'purchase_header_id', // Mapeo especial para mantener consistencia
    purchase_header_id: 'purchase_header_id',
    person_id: 'person_id',
    sale_channel_id: 'sale_channel_id',
    purchase_date: 'purchase_date',
    order_date: 'purchase_date',
    total_amount: 'total_amount',
    paid_amount: 'paid_amount',
    address: 'delivery_address',
    delivery_address: 'delivery_address', // one_off_purchase_header SÍ tiene delivery_address directo
    locality_id: 'locality_id',
    zone_id: 'zone_id',
    price_list_id: 'price_list_id',
    notes: 'notes',
    status: 'status',
    payment_status: 'payment_status',
    delivery_status: 'delivery_status',
    created_at: 'created_at',
    updated_at: 'updated_at',
    scheduled_delivery_date: 'scheduled_delivery_date',

    // Campos relacionados de person
    phone: 'person.phone',
    name: 'person.name',
    'person.address': 'person.address',
    'person.phone': 'person.phone',
    'person.name': 'person.name',
    'customer.address': 'person.address',
    'customer.phone': 'person.phone',
    'customer.name': 'person.name',
    person_address: 'person.address', // Para diferenciar del delivery_address
    order_type: '',
  };

  return getMappedField(fieldMappings, field);
}

export function mapPersonSortFields(field: string): string {
  const fieldMappings: Record<string, string> = {
    id: 'person_id',
    personId: 'person_id',
    person_id: 'person_id',
    taxId: 'tax_id',
    tax_id: 'tax_id',
    localityId: 'locality_id',
    locality_id: 'locality_id',
    zoneId: 'zone_id',
    zone_id: 'zone_id',
    'locality.name': 'locality.name',
    'zone.name': 'zone.name',
  };

  return getMappedField(fieldMappings, field) ?? field;
}

/**
 * Parsea un string de ordenamiento (sortBy) y devuelve un array de objetos
 * para la cláusula `orderBy` de Prisma.
 *
 * @param sortBy - String de ordenamiento, ej: "name,-createdAt,relation.field".
 * @param defaultOrderBy - Cláusula orderBy por defecto si sortBy no se proporciona o está vacío.
 * @param fieldMapper - Función opcional para mapear nombres de campos
 * @returns Un array para la cláusula orderBy de Prisma, o undefined si no hay ordenamiento aplicable.
 */
export function parseSortByString(
  sortBy?: string,
  defaultOrderBy?: any | any[],
  fieldMapper?: (field: string) => string | undefined,
): any[] | undefined {
  let orderByArray: any[] | undefined;

  if (sortBy && sortBy.trim() !== '') {
    orderByArray = sortBy
      .split(',')
      .map((field) => field.trim()) // Limpiar espacios alrededor de cada campo
      .filter((trimmedField) => trimmedField !== '') // Ignorar campos vacíos si la coma es doble, ej: "name,,"
      .map((trimmedField) => {
        let direction: 'asc' | 'desc' = 'asc';
        let fieldName = trimmedField;

        // Manejar formato "-field" (ej: "-phone") - MANTENER PARA COMPATIBILIDAD
        if (trimmedField.startsWith('-')) {
          direction = 'desc';
          fieldName = trimmedField.substring(1);
        }
        // Manejar formato "field:direction" (ej: "phone:asc") - NUEVO FORMATO
        else if (trimmedField.includes(':')) {
          const parts = trimmedField.split(':');
          fieldName = parts[0];
          direction = parts[1] === 'desc' ? 'desc' : 'asc';
        }

        // Aplicar el mapeo de campos si se proporciona un fieldMapper
        if (fieldMapper) {
          fieldName = fieldMapper(fieldName);
        }

        if (!fieldName || fieldName.trim() === '') {
          return null;
        }

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
      })
      .filter((orderClause) => orderClause !== null);
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
