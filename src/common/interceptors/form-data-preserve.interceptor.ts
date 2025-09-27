import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class FormDataPreserveInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Solo procesar si es multipart/form-data
    if (request.headers['content-type']?.includes('multipart/form-data')) {
      console.log(
        '🔍 DEBUG - FormDataPreserveInterceptor - Request body antes:',
        request.body,
      );

      // Preservar los valores string originales para campos boolean
      if (request.body) {
        // Lista de campos que deben preservarse como string para Transform
        const booleanFields = ['is_returnable'];

        booleanFields.forEach((field) => {
          if (request.body[field] !== undefined) {
            // Forzar a string si no lo es ya
            const originalValue = request.body[field];
            request.body[field] = String(originalValue);
            console.log(
              `🔍 DEBUG - FormDataPreserveInterceptor - Preservando ${field}: ${originalValue} -> ${request.body[field]} (${typeof request.body[field]})`,
            );
          }
        });

        console.log(
          '🔍 DEBUG - FormDataPreserveInterceptor - Request body después:',
          request.body,
        );
      }
    }

    return next.handle().pipe(
      tap(() => {
        // Log adicional para ver si el body se mantiene
        console.log(
          '🔍 DEBUG - FormDataPreserveInterceptor - Request body al final:',
          request.body,
        );
      }),
    );
  }
}
