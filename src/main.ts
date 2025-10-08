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

  // Configuración de CORS más específica para desarrollo
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173', // Vite dev server
    'http://localhost:5174', // Vite dev server alternate port
    'http://localhost:4173', // Vite preview
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
  ];

  uploadsDirectories.forEach((dir) => {
    const fs = require('fs-extra');
    fs.ensureDirSync(dir);
  });

  app.enableShutdownHooks();

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sgarav API')
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
- **Gestión Híbrida de Órdenes**: Suscripciones + productos adicionales
- **Sistema de Comodatos**: Préstamo de dispensadores y equipos
- **Listas de Precios Diferenciadas**: Precios por cliente/contrato
- **Control de Stock en Tiempo Real**: Inventario centralizado
- **Rutas Optimizadas**: Planificación automática de entregas
`,
    )
    .setVersion('1.0.0')
    .setContact(
      'Equipo de Desarrollo Sgarav',
      'https://sgarav.com',
      'desarrollo@sgarav.com',
    )
    .setLicense('Propietario', 'https://sgarav.com/license')
    .addServer('http://localhost:3000', 'Servidor de Desarrollo')
    .addServer('https://api.sgarav.com', 'Servidor de Producción')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Ingrese el token JWT obtenido del endpoint /auth/login',
      },
      'JWT-auth',
    )
    .addTag('Health', 'Endpoints de verificación del estado del sistema')
    .addTag('Autenticación/Usuarios', 'Gestión de usuarios y autenticación')
    .addTag('Clientes', 'Gestión de personas y clientes')
    .addTag('Productos & Artículos', 'Catálogo de productos y artículos')
    .addTag('Inventario', 'Control de stock y movimientos')
    .addTag('Vehículos', 'Gestión de flota de vehículos')
    .addTag('Inventario de Vehículos', 'Stock móvil en vehículos')
    .addTag('Zonas', 'Gestión de zonas geográficas')
    .addTag('Planes de Suscripción', 'Planes y configuraciones de suscripción')
    .addTag('Pedidos & Compras de una sola vez', 'Gestión de órdenes y pedidos')
    .addTag('Comodatos', 'Sistema de préstamo de equipos')
    .addTag('Hojas de Ruta', 'Planificación y seguimiento de entregas')
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
