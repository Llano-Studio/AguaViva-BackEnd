import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  Logger,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as helmet from 'helmet';
import * as compression from 'compression';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.use(helmet.default());

  app.use(compression());

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              
      forbidNonWhitelisted: true,   
      transform: true,               
    }),
  );

  const { httpAdapter } = app.get(HttpAdapterHost);
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

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    include: [AppModule],
  });
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`🚀 Servidor escuchando en http://localhost:${port}/api (v1)`);
  logger.log(`📖 Documentación Swagger en http://localhost:${port}/docs`);
}

bootstrap();
