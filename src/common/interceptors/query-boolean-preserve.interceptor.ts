import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class QueryBooleanPreserveInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Solo procesar query parameters
    if (request.query) {
      // Lista de campos booleanos que deben preservarse como string para Transform
      const booleanFields = ['requires_delivery', 'is_active', 'is_returnable'];

      booleanFields.forEach((field) => {
        if (request.query[field] !== undefined) {
          // Preservar el valor original como string
          const originalValue = request.query[field];
          
          // Asegurar que se mantenga como string para que @Transform pueda procesarlo
          request.query[field] = String(originalValue);
        }
      });
    }

    return next.handle().pipe(
      tap(() => {
        // Log adicional si es necesario
      }),
    );
  }
}