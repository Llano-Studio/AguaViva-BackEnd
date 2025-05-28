import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function handlePrismaError(error: any, entityName: string = 'registro') {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Intenta obtener el campo que causó el conflicto del target
        const target = error.meta?.target as string[] | string | undefined;
        let fieldMessage = 'algún campo único';
        if (Array.isArray(target) && target.length > 0) {
          fieldMessage = target.join(', ');
        } else if (typeof target === 'string') {
          fieldMessage = target;
        }
        throw new ConflictException(`El ${entityName} con este valor para '${fieldMessage}' ya existe.`);
      case 'P2003':
        const fieldName = error.meta?.field_name as string | undefined;
        const modelName = error.meta?.modelName as string | undefined;
        let foreignKeyMessage = `No se puede eliminar el ${entityName} porque está referenciado`;
        if (fieldName) {
            foreignKeyMessage += ` por el campo '${fieldName}'`;
        }
        if (modelName) {
            foreignKeyMessage += ` en '${modelName}'`;
        }
        foreignKeyMessage += '. Elimine o reasigne estas referencias primero.';
        throw new ConflictException(foreignKeyMessage);
      case 'P2025':
        throw new NotFoundException(`El ${entityName} no fue encontrado para esta operación.`);
      default:
        // Otros errores conocidos de Prisma
        throw new InternalServerErrorException(`Error de base de datos (${error.code}) al procesar el ${entityName}.`);
    }
  }
  // Errores no esperados o no de Prisma
  throw new InternalServerErrorException(`Error inesperado al procesar el ${entityName}: ${error.message || error}`);
} 