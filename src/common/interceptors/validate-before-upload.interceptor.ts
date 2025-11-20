import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CleanupFileOnErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Obtener el archivo subido del request
        const request = context.switchToHttp().getRequest();
        const uploadedFile = request.file;

        // Si hay un archivo subido y ocurrió un error, eliminarlo
        if (uploadedFile && uploadedFile.path) {
          try {
            // Verificar si el archivo existe antes de intentar eliminarlo
            if (fs.existsSync(uploadedFile.path)) {
              fs.unlinkSync(uploadedFile.path);
            }
          } catch (deleteError) {
            console.error('Error eliminando archivo:', deleteError);
          }
        }

        // Re-lanzar el error original
        return throwError(() => error);
      }),
    );
  }
}