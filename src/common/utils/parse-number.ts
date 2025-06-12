/**
 * Utilidades para parsing seguro de números desde strings
 */

/**
 * Convierte un valor a número de forma segura con validación regex previa
 * @param value - Valor a convertir
 * @param kind - Tipo de número: 'int' para enteros, 'float' para decimales
 * @returns El número convertido o el valor original si no es válido
 */
export function parseNumber<T extends 'int' | 'float'>(value: unknown, kind: T): unknown {
  if (typeof value !== 'string') return value;
  
  const trimmed = value.trim();
  
  // Verificar que es un número válido según el tipo
  const regex = kind === 'int' 
    ? /^-?\d+$/ // Solo enteros (con signo opcional)
    : /^-?\d*\.?\d+$/; // Enteros o decimales (con signo opcional)
  
  if (!regex.test(trimmed)) {
    return value; // Devolver valor original para que falle la validación
  }
  
  const num = kind === 'int' 
    ? parseInt(trimmed, 10) 
    : globalThis.parseFloat(trimmed);
    
  return isNaN(num) ? value : num;
}

/**
 * Helper específico para enteros
 */
export function parseInteger(value: unknown): unknown {
  return parseNumber(value, 'int');
}

/**
 * Helper específico para números decimales
 */
export function parseDecimal(value: unknown): unknown {
  return parseNumber(value, 'float');
} 