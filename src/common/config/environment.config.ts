import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  // Configuración de base de datos
  database: {
    url: process.env.DATABASE_URL,
  },

  // Configuración de JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Configuración de la aplicación
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    environment: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || 'api',
    version: process.env.APP_VERSION || '1.0.0',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  // Configuración de correo
  mail: {
    from: process.env.MAIL_FROM || 'noreply@aguaviva.com',
    host: process.env.MAIL_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.MAIL_PORT || '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },

  // Configuración de archivos
  files: {
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB por defecto
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif'],
  },

  // Configuración de cache
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutos por defecto
    max: parseInt(process.env.CACHE_MAX_ITEMS || '1000', 10),
  },

  // Configuración de semáforo de pagos (puede ser sobrescrita por variables de entorno)
  paymentSemaphore: {
    yellowThresholdDays: parseInt(
      process.env.PAYMENT_YELLOW_THRESHOLD_DAYS || '5',
      10,
    ),
    redThresholdDays: parseInt(
      process.env.PAYMENT_RED_THRESHOLD_DAYS || '10',
      10,
    ),
    cacheTtlMinutes: parseInt(
      process.env.PAYMENT_SEMAPHORE_CACHE_TTL || '30',
      10,
    ),
  },

  // Configuración de inventario
  inventory: {
    defaultWarehouseId: parseInt(process.env.DEFAULT_WAREHOUSE_ID || '1', 10),
  },

  // Configuración de paginación
  pagination: {
    defaultPage: parseInt(process.env.DEFAULT_PAGE || '1', 10),
    defaultLimit: parseInt(process.env.DEFAULT_LIMIT || '10', 10),
    maxLimit: parseInt(process.env.MAX_LIMIT || '100', 10),
  },
}));
