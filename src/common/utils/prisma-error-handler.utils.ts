import { ConflictException, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function handlePrismaError(error: any, entityName: string = 'registro') {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2000':
        // Error específico para valores que exceden el límite de caracteres
        const columnName = error.meta?.column_name as string | undefined;
        const tableName = error.meta?.table as string | undefined;
        let lengthMessage = `Uno de los campos del ${entityName} excede el límite de caracteres permitido`;
        if (columnName) {
          // Mapear nombres de columnas técnicos a nombres más amigables
          const friendlyFieldNames: { [key: string]: string } = {
            'cuil': 'CUIL/CUIT',
            'email': 'correo electrónico',
            'name': 'nombre',
            'description': 'descripción',
            'code': 'código',
            'address': 'dirección',
            'phone': 'teléfono'
          };
          const friendlyName = friendlyFieldNames[columnName.toLowerCase()] || columnName;
          lengthMessage = `El campo '${friendlyName}' excede el límite de caracteres permitido`;
        }
        lengthMessage += '. Por favor, reduzca la cantidad de caracteres e intente nuevamente.';
        throw new BadRequestException(lengthMessage);
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