import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as compression from 'compression';
import { json, urlencoded } from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DatabaseErrorInterceptor } from './common/interceptors/database-error.interceptor';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { isOriginAllowed } from './common/utils/cors.utils';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);

  app.use(helmet.default({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "*"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*"],
      },
    },
    // En desarrollo, ser menos restrictivo
    ...(configService.get('app.app.environment') === 'development' && {
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
    })
  }));

  app.use(compression());

  const maxFileSize = configService.get('app.files.maxFileSize') || 5 * 1024 * 1024;
  app.use(json({ limit: `${Math.floor(maxFileSize / (1024 * 1024))}mb` }));
  app.use(urlencoded({ extended: true, limit: `${Math.floor(maxFileSize / (1024 * 1024))}mb` }));


  app.useStaticAssets(join(process.cwd(), 'public'), { 
    prefix: '/public/',
    setHeaders: (res, path) => {
      if (path.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000'); 
        res.setHeader('Access-Control-Allow-Origin', '*');
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

  const isDevelopment = configService.get('app.app.environment') === 'development' || process.env.NODE_ENV === 'development';

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
    exclude: ['/', '/health'] 
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              
      forbidNonWhitelisted: true,   
      transform: true,
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
  ];
  
  uploadsDirectories.forEach(dir => {
    const fs = require('fs-extra');
    fs.ensureDirSync(dir);
  });

  app.enableShutdownHooks();  

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sgarav API')
    .setDescription('API para el sistema de gestión de agua')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = configService.get('app.app.port') || process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Servidor escuchando en http://localhost:${port}/${apiPrefix} (v1)`);
  logger.log(`📖 Documentación Swagger en http://localhost:${port}/docs`);
  logger.log(`🌍 Entorno: ${configService.get('app.app.environment') || 'development'}`);
}

bootstrap();
