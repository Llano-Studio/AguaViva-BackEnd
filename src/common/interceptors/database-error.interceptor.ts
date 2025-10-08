import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
} from '@prisma/client/runtime/library';

@Injectable()
export class DatabaseErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Manejo específico para error de conexión a la base de datos
        if (error instanceof PrismaClientInitializationError) {
          console.error('Error de conexión a base de datos:', error);
          return throwError(
            () =>
              new HttpException(
                {
                  status: HttpStatus.SERVICE_UNAVAILABLE,
                  error: 'Servicio temporalmente no disponible',
                  message:
                    'No se puede conectar al servidor de base de datos. Por favor, inténtelo más tarde.',
                  details:
                    process.env.NODE_ENV === 'development'
                      ? error.message
                      : undefined,
                },
                HttpStatus.SERVICE_UNAVAILABLE,
              ),
          );
        }

        // Manejo para otros errores de Prisma
        if (error instanceof PrismaClientKnownRequestError) {
          console.error('Error de Prisma:', error);

          // Manejar diferentes tipos de errores de Prisma según el código
          switch (error.code) {
            case 'P2002': // Error de unicidad
              return throwError(
                () =>
                  new HttpException(
                    {
                      status: HttpStatus.CONFLICT,
                      error: 'Conflicto de datos',
                      message: 'Ya existe un registro con esos datos.',
                    },
                    HttpStatus.CONFLICT,
                  ),
              );

            case 'P2025': // Not found
              return throwError(
                () =>
                  new HttpException(
                    {
                      status: HttpStatus.NOT_FOUND,
                      error: 'Recurso no encontrado',
                      message: 'El recurso solicitado no existe.',
                    },
                    HttpStatus.NOT_FOUND,
                  ),
              );

            default:
              return throwError(
                () =>
                  new HttpException(
                    {
                      status: HttpStatus.INTERNAL_SERVER_ERROR,
                      error: 'Error de base de datos',
                      message: 'Ocurrió un error al procesar su solicitud.',
                    },
                    HttpStatus.INTERNAL_SERVER_ERROR,
                  ),
              );
          }
        }

        return throwError(() => error);
      }),
    );
  }
}
