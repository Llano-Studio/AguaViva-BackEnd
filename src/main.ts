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

  app.use(helmet.default());

  app.use(compression());

  const maxFileSize = configService.get('app.files.maxFileSize') || 5 * 1024 * 1024;
  app.use(json({ limit: `${Math.floor(maxFileSize / (1024 * 1024))}mb` }));
  app.use(urlencoded({ extended: true, limit: `${Math.floor(maxFileSize / (1024 * 1024))}mb` }));

  // CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const apiPrefix = configService.get('app.app.apiPrefix') || 'api';
  app.setGlobalPrefix(apiPrefix);

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
  app.useStaticAssets(join(process.cwd(), 'public'), { 
    prefix: '/public/',
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
