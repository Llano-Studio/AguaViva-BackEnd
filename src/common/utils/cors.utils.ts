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
  console.log(`[CORS] Verificando origen: "${origin}"`);
  console.log(`[CORS] Modo desarrollo: ${isDevelopment}`);
  console.log(`[CORS] Orígenes permitidos: [${allowedOrigins.join(', ')}]`);
  
  // Permitir requests sin origin (como Postman, aplicaciones móviles, etc.)
  if (!origin) {
    console.log('[CORS] ✅ Permitido: Sin origen');
    return true;
  }
  
  // En desarrollo, ser muy permisivo con localhost
  if (isDevelopment) {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log(`[CORS] ✅ Permitido en desarrollo: ${origin}`);
      return true;
    }
    // También permitir otros orígenes en desarrollo
    console.log(`[CORS] ✅ Permitido (modo desarrollo): ${origin}`);
    return true;
  }
  
  // Validar localhost/127.0.0.1 con regex estricto en producción
  const localhostPattern = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/;
  if (localhostPattern.test(origin)) {
    console.log(`[CORS] ✅ Permitido (localhost pattern): ${origin}`);
    return true;
  }
  
  // Permitir orígenes específicos
  if (allowedOrigins.includes(origin)) {
    console.log(`[CORS] ✅ Permitido (en lista): ${origin}`);
    return true;
  }
  
  console.log(`[CORS] ❌ Rechazado: ${origin}`);
  return false;
} 