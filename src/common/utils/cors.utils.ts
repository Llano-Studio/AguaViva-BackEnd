/**
 * Utilidades para validación de CORS
 */

/**
 * Valida si un origen está permitido según las reglas de CORS
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  isDevelopment: boolean = false
): boolean {
  // Permitir requests sin origin (como Postman, aplicaciones móviles, etc.)
  if (!origin) return true;
  
  // Validar localhost/127.0.0.1 con regex estricto
  const localhostPattern = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/;
  if (localhostPattern.test(origin)) {
    return true;
  }
  
  // Permitir orígenes específicos
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // En desarrollo, ser más permisivo
  if (isDevelopment) {
    return true;
  }
  
  return false;
} 