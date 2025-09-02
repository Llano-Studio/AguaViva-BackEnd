import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
            cuil: 'CUIL/CUIT',
            email: 'correo electrónico',
            name: 'nombre',
            description: 'descripción',
            code: 'código',
            address: 'dirección',
            phone: 'teléfono',
          };
          const friendlyName =
            friendlyFieldNames[columnName.toLowerCase()] || columnName;
          lengthMessage = `El campo '${friendlyName}' excede el límite de caracteres permitido`;
        }
        lengthMessage +=
          '. Por favor, reduzca la cantidad de caracteres e intente nuevamente.';
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
        throw new ConflictException(
          `El ${entityName} con este valor para '${fieldMessage}' ya existe.`,
        );
      case 'P2003':
        const fieldName = error.meta?.field_name as string | undefined;
        const modelName = error.meta?.modelName as string | undefined;

        // Mensajes específicos para diferentes entidades
        let foreignKeyMessage = `No se puede eliminar el ${entityName}`;

        if (entityName.toLowerCase().includes('producto')) {
          foreignKeyMessage = `No se puede eliminar el producto porque está siendo utilizado en:`;

          // Mapear nombres técnicos a nombres amigables para productos
          const productRelationships: { [key: string]: string } = {
            order_item: 'pedidos existentes',
            subscription_plan_product: 'planes de suscripción',
            price_list_item: 'listas de precios',
            inventory: 'registros de inventario',
            inventory_transaction: 'transacciones de inventario',
            payment_line: 'líneas de pago',
            one_off_purchase: 'compras puntuales',
            comodato: 'comodatos activos',
            vehicle_inventory: 'inventario de vehículos',
          };

          if (modelName && productRelationships[modelName.toLowerCase()]) {
            foreignKeyMessage += ` ${productRelationships[modelName.toLowerCase()]}`;
          } else if (modelName) {
            foreignKeyMessage += ` ${modelName}`;
          }

          foreignKeyMessage += '. Para eliminar este producto, primero debe:';
          foreignKeyMessage +=
            '\n• Eliminar o modificar todos los pedidos que lo contengan';
          foreignKeyMessage +=
            '\n• Removerlo de todos los planes de suscripción';
          foreignKeyMessage += '\n• Eliminarlo de las listas de precios';
          foreignKeyMessage += '\n• Resolver cualquier comodato activo';
          foreignKeyMessage +=
            '\n• Limpiar el inventario y transacciones relacionadas';
        } else if (entityName.toLowerCase().includes('categoría')) {
          foreignKeyMessage = `No se puede eliminar la categoría porque tiene productos asociados. Primero reasigne o elimine todos los productos de esta categoría.`;
        } else {
          // Mensaje genérico mejorado
          foreignKeyMessage += ` porque está referenciado`;
          if (fieldName) {
            foreignKeyMessage += ` por el campo '${fieldName}'`;
          }
          if (modelName) {
            foreignKeyMessage += ` en '${modelName}'`;
          }
          foreignKeyMessage +=
            '. Elimine o reasigne estas referencias primero.';
        }

        throw new ConflictException(foreignKeyMessage);
      case 'P2022':
        // Error de columna que no puede ser nula o valor que no cumple restricciones
        const columnInfo = error.meta?.column_name as string | undefined;
        const tableInfo = error.meta?.table as string | undefined;
        let constraintMessage = `Error de restricción de base de datos en ${entityName}`;
        if (columnInfo && tableInfo) {
          constraintMessage = `El campo '${columnInfo}' en la tabla '${tableInfo}' no cumple con las restricciones de la base de datos`;
        } else if (columnInfo) {
          constraintMessage = `El campo '${columnInfo}' no cumple con las restricciones de la base de datos`;
        }
        console.error(`P2022 Error Details:`, {
          code: error.code,
          meta: error.meta,
          message: error.message,
          constraintMessage,
        });
        throw new BadRequestException(constraintMessage);
      case 'P2025':
        throw new NotFoundException(
          `El ${entityName} no fue encontrado para esta operación.`,
        );
      default:
        // Otros errores conocidos de Prisma
        console.error(`Unhandled Prisma Error:`, {
          code: error.code,
          meta: error.meta,
          message: error.message,
        });
        throw new InternalServerErrorException(
          `Error de base de datos (${error.code}) al procesar el ${entityName}.`,
        );
    }
  }
  // Errores no esperados o no de Prisma
  throw new InternalServerErrorException(
    `Error inesperado al procesar el ${entityName}: ${error.message || error}`,
  );
}