import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
} from '@prisma/client/runtime/library';

@Catch(PrismaClientInitializationError, PrismaClientKnownRequestError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(
    exception: PrismaClientInitializationError | PrismaClientKnownRequestError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Definir el estado HTTP y el mensaje según el tipo de error
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let details:
      | string
      | {
          code: string;
          meta: Record<string, unknown> | undefined;
          message: string;
        }
      | undefined = undefined;

    if (exception instanceof PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Servicio temporalmente no disponible';

      // En desarrollo mostramos más detalles
      if (process.env.NODE_ENV === 'development') {
        details = exception.message;
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      // Mapear los códigos de error de Prisma a códigos HTTP y mensajes apropiados
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Ya existe un recurso con estos datos';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'No se encontró el recurso solicitado';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = 'Error en la solicitud';
      }

      if (process.env.NODE_ENV === 'development') {
        details = {
          code: exception.code,
          meta: exception.meta,
          message: exception.message,
        };
      }
    }

    // Si es una solicitud de API, devuelve JSON
    if (request.url.startsWith('/api') || request.accepts('json')) {
      response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message,
        details,
      });
    }
    // Si es una solicitud web, muestra una página HTML amigable
    else {
      response.status(status).type('text/html').send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Agua Viva-Rica - Error de Servicio</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background-color: #f7f9fc;
                  color: #333;
                  line-height: 1.6;
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: white;
                  padding: 30px;
                  border-radius: 5px;
                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                h1 {
                  color: #2c3e50;
                  margin-top: 0;
                }
                .error-code {
                  font-size: 24px;
                  color: #e74c3c;
                  margin-bottom: 20px;
                }
                .btn {
                  display: inline-block;
                  padding: 10px 20px;
                  background: #3498db;
                  color: white;
                  text-decoration: none;
                  border-radius: 4px;
                  margin-top: 20px;
                }
                .btn:hover {
                  background: #2980b9;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Servicio Temporalmente No Disponible</h1>
                <div class="error-code">Error ${status}</div>
                <p>${message}</p>
                <p>Lamentamos las molestias. Nuestro equipo técnico ha sido notificado y está trabajando para resolver el problema lo antes posible.</p>
                <p>Por favor, inténtelo de nuevo más tarde.</p>
                ${details ? `<p><strong>Detalles técnicos:</strong> ${JSON.stringify(details)}</p>` : ''}
                <a href="/" class="btn">Volver al inicio</a>
              </div>
            </body>
          </html>
        `);
    }
  }
}
