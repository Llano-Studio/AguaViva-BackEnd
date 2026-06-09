import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as compression from 'compression';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DatabaseErrorInterceptor } from './common/interceptors/database-error.interceptor';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);

  app.use(
    helmet.default({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:', '*'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", 'http://localhost:*', 'http://127.0.0.1:*'],
        },
      },
      // En desarrollo, ser menos restrictivo
      ...(configService.get('app.app.environment') === 'development' && {
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: false,
      }),
    }),
  );

  app.use(compression());

  const maxFileSize =
    configService.get('app.files.maxFileSize') || 5 * 1024 * 1024;
  app.use(json({ limit: `${Math.floor(maxFileSize / (1024 * 1024))}mb` }));
  app.use(
    urlencoded({
      extended: true,
      limit: `${Math.floor(maxFileSize / (1024 * 1024))}mb`,
    }),
  );

  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
    setHeaders: (res, path) => {
      if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      // 🆕 Configuración CORS para archivos PDF
      if (path.match(/\.pdf$/i)) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Accept, Authorization, X-Requested-With',
        );
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache de 1 hora para PDFs
      }
    },
  });

  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/api/public/',
    setHeaders: (res, path) => {
      if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      if (path.match(/\.pdf$/i)) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Accept, Authorization, X-Requested-With',
        );
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  });

  // 🆕 Servir archivos temporales bajo /temp para descargas efímeras
  app.useStaticAssets(join(process.cwd(), 'temp'), {
    prefix: '/temp/',
    setHeaders: (res, path) => {
      if (path.match(/\.pdf$/i)) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Accept, Authorization, X-Requested-With',
        );
        res.setHeader('Cache-Control', 'public, max-age=1800'); // 30 minutos para temporales
      }
    },
  });

  // Configuración de CORS incluyendo orígenes de entorno
  const envOrigins = [
    configService.get('app.app.frontendUrl'),
    process.env.APP_URL,
    process.env.PUBLIC_BASE_URL,
  ].filter((o) => !!o);

  const allowedOrigins = [
    ...envOrigins,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:4173',
  ];

  const isDevelopment =
    configService.get('app.app.environment') === 'development' ||
    process.env.NODE_ENV === 'development';

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`🚫 Origen rechazado por CORS: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
  });

  const apiPrefix = configService.get('app.app.apiPrefix') || 'api';
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['/', '/health'],
  });

  // Configurar ValidationPipe global con opciones flexibles
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: false,
      disableErrorMessages: false,
    }),
  );

  // Aplicar el interceptor global para manejar errores de base de datos
  app.useGlobalInterceptors(new DatabaseErrorInterceptor());

  // Aplicar el filtro global para manejar excepciones de base de datos
  app.useGlobalFilters(new DatabaseExceptionFilter());

  const uploadPath = configService.get('app.files.uploadPath') || './uploads';
  const uploadsDirectories = [
    './public/uploads/profile-images',
    './public/uploads/products',
    './public/uploads/evidence',
    './public/uploads/delivery-evidence',
    './public/uploads/reconciliations',
    './public/uploads/contracts',
    './public/pdfs', // 🆕 Directorio para PDFs generados
    './public/pdfs/collections', // 🆕 Subdirectorio para hojas de ruta de cobranzas automáticas
  ];

  uploadsDirectories.forEach((dir) => {
    const fs = require('fs-extra');
    fs.ensureDirSync(dir);
  });

  app.enableShutdownHooks();

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('🌊 Sgarav API - Sistema de Gestión de Agua')
    .setDescription(
      `
# API para el Sistema de Gestión de Agua Sgarav

## 🌊 Descripción General
Sistema integral para la gestión de distribución de agua, incluyendo:
- **Gestión de Clientes**: Registro y administración de personas y empresas
- **Suscripciones y Planes**: Manejo de planes de suscripción y comodatos
- **Inventario**: Control de stock en almacenes y vehículos
- **Órdenes y Entregas**: Gestión completa del ciclo de pedidos
- **Rutas y Logística**: Planificación de entregas y hojas de ruta
- **Facturación y Pagos**: Procesamiento de transacciones y cobranzas

## 🔐 Autenticación
La API utiliza autenticación JWT Bearer Token. Para acceder a los endpoints protegidos:
1. Inicie sesión en \`/api/auth/login\`
2. Use el token recibido en el header: \`Authorization: Bearer <token>\`
3. El token se renovará automáticamente en Swagger si está habilitado

## 📊 Roles de Usuario
- **SUPERADMIN**: Acceso completo al sistema
- **ADMINISTRATIVE**: Gestión operativa y consultas
- **BOSSADMINISTRATIVE**: Supervisión y reportes
- **DRIVERS**: Acceso limitado para conductores

## 🚀 Funcionalidades Principales
- **🔄 Gestión Híbrida de Órdenes**: Suscripciones + productos adicionales
- **📦 Sistema de Comodatos**: Préstamo de dispensadores y equipos
- **💰 Listas de Precios Diferenciadas**: Precios por cliente/contrato
- **📊 Control de Stock en Tiempo Real**: Inventario centralizado
- **🗺️ Rutas Optimizadas**: Planificación automática de entregas
- **💳 Gestión de Pagos de Ciclos**: Cobranzas automáticas y manuales
- **📋 Hojas de Ruta Inteligentes**: Soporte para múltiples tipos de órdenes

## 🆕 Desarrollos Recientes
- **Órdenes Híbridas**: Combinación de productos de suscripción + adicionales
- **Pagos de Ciclos**: Sistema avanzado de cobranzas por ciclos de suscripción
- **Hojas de Ruta Mejoradas**: Soporte para one-off, híbridas, suscripciones y cobranzas
- **Gestión de Suscripciones**: Control completo de ciclos y preferencias de entrega

## 📖 Guía de Uso
Para comenzar a usar la API:
1. **Autenticarse**: POST \`/api/auth/login\`
2. **Explorar Clientes**: GET \`/api/persons\`
3. **Crear Suscripciones**: POST \`/api/customer-subscription\`
4. **Gestionar Órdenes**: POST \`/api/orders\`
5. **Planificar Entregas**: POST \`/api/route-sheet\`
`,
    )
    .setVersion('2.0.0')
    .setContact(
      'Equipo de Desarrollo Sgarav',
      'https://sgarav.com',
      'desarrollo@sgarav.com',
    )
    .setLicense('Propietario', 'https://sgarav.com/license')
    .setTermsOfService('https://sgarav.com/terms')
    .addServer('http://localhost:3000', 'Servidor de Desarrollo Local')
    .addServer('https://api-dev.sgarav.com', 'Servidor de Desarrollo')
    .addServer('https://api.sgarav.com', 'Servidor de Producción')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          '🔑 Ingrese el token JWT obtenido del endpoint /auth/login. El token se renovará automáticamente.',
        name: 'Authorization',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('🏥 Health', 'Endpoints de verificación del estado del sistema')
    .addTag(
      '🔐 Autenticación/Usuarios',
      'Gestión de usuarios, roles y autenticación JWT',
    )
    .addTag('👥 Clientes', 'Gestión de personas, clientes y datos de contacto')
    .addTag(
      '📦 Productos & Artículos',
      'Catálogo de productos, categorías y artículos',
    )
    .addTag('📊 Inventario', 'Control de stock, movimientos y almacenes')
    .addTag('🚛 Vehículos', 'Gestión de flota de vehículos y conductores')
    .addTag('📦 Inventario de Vehículos', 'Stock móvil y carga en vehículos')
    .addTag('🗺️ Zonas', 'Gestión de zonas geográficas y rutas')
    .addTag(
      '📋 Planes de Suscripción',
      'Planes, configuraciones y productos incluidos',
    )
    .addTag(
      '🔄 Suscripciones de Clientes',
      'Gestión de suscripciones activas y ciclos',
    )
    .addTag(
      '💳 Pagos de Ciclos',
      'Cobranzas automáticas, manuales y gestión de créditos',
    )
    .addTag('🛒 Pedidos & Órdenes', 'Órdenes híbridas, suscripciones y one-off')
    .addTag('🛍️ Compras One-Off', 'Compras únicas y productos adicionales')
    .addTag('❌ Órdenes de Cancelación', 'Gestión de cancelaciones y retiros')
    .addTag('🏠 Comodatos', 'Sistema de préstamo de dispensadores y equipos')
    .addTag(
      '🗺️ Hojas de Ruta',
      'Planificación, seguimiento y entregas multi-tipo',
    )
    .addTag(
      '💰 Listas de Precios',
      'Gestión de precios diferenciados por cliente',
    )
    .addTag('🌍 Ubicaciones', 'Países, provincias y localidades')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      docExpansion: 'none',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
    },
    customSiteTitle: 'Sgarav API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #1976d2; }
      .swagger-ui .scheme-container { background: #fafafa; padding: 15px; border-radius: 4px; }
    `,
  });

  const port = configService.get('app.app.port') || process.env.PORT || 3000;
  await app.listen(port);

  logger.log(
    `🚀 Servidor escuchando en http://localhost:${port}/${apiPrefix} (v1)`,
  );
  logger.log(`📖 Documentación Swagger en http://localhost:${port}/docs`);
  logger.log(
    `🌍 Entorno: ${configService.get('app.app.environment') || 'development'}`,
  );
}

bootstrap();
