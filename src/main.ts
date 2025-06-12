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

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (como Postman, aplicaciones móviles, etc.)
      if (!origin) return callback(null, true);
      
      // En desarrollo, permitir localhost/127.0.0.1 con regex estricto
      const localhostPattern = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/;
      if (localhostPattern.test(origin)) {
        return callback(null, true);
      }
      
      // Permitir orígenes específicos
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // En desarrollo, ser más permisivo
      const isDevelopment = configService.get('app.app.environment') === 'development' || process.env.NODE_ENV === 'development';
      if (isDevelopment) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma'
    ],
    credentials: true,
    optionsSuccessStatus: 200, // Para navegadores legacy
    exposedHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges'],
  });

  // Middleware adicional para manejar OPTIONS preflight
  app.use((req, res, next) => {
    const isDevelopment = configService.get('app.app.environment') === 'development' || process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      logger.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    }
    
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      
      // Validar origen con el mismo criterio estricto que CORS
      let allowOrigin = false;
      if (!origin) {
        allowOrigin = true; // Sin origin permitido
      } else {
        const localhostPattern = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d{1,5})?$/;
        if (localhostPattern.test(origin) || allowedOrigins.includes(origin) || isDevelopment) {
          allowOrigin = true;
        }
      }
      
      if (allowOrigin) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '86400'); // 24 hours
        
        if (isDevelopment) {
          logger.log(`OPTIONS preflight handled for origin: ${origin}`);
        }
        
        return res.sendStatus(200);
      } else {
        if (isDevelopment) {
          logger.warn(`OPTIONS preflight rejected for origin: ${origin}`);
        }
        return res.sendStatus(403);
      }
    }
    next();
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
