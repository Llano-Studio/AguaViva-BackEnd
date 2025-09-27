import {
  createParamDecorator,
  ExecutionContext,
  ValidationPipe,
} from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

export const FormDataBody = createParamDecorator(
  async (data: any, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const body = request.body;

    console.log('🔍 DEBUG - FormDataBody - Body original:', body);

    // Solo procesar si es multipart/form-data
    if (request.headers['content-type']?.includes('multipart/form-data')) {
      // Lista de campos boolean que deben preservarse como string
      const booleanFields = [
        'is_returnable',
        'isActive',
        'is_active',
        'owns_returnable_containers',
      ];

      // Preservar valores string para campos boolean
      const preservedBody = { ...body };

      // Determinar campos permitidos basándose en el DTO
      let allowedFields = [];
      const dtoName = data?.name || '';

      if (dtoName.includes('Product')) {
        allowedFields = [
          'category_id',
          'description',
          'volume_liters',
          'price',
          'is_returnable',
          'serial_number',
          'notes',
          'total_stock',
          'productImage',
        ];
      } else if (dtoName.includes('User') || dtoName.includes('Register')) {
        allowedFields = [
          'email',
          'password',
          'name',
          'role',
          'isActive',
          'notes',
          'profileImage',
        ];
      } else if (dtoName.includes('Person')) {
        allowedFields = [
          'name',
          'address',
          'phone',
          'tax_id',
          'email',
          'birth_date',
          'type',
          'locality_id',
          'zone_id',
          'owns_returnable_containers',
          'is_active',
          'notes',
        ];
      } else {
        // Si no reconocemos el DTO, permitir todos los campos
        allowedFields = Object.keys(preservedBody);
      }

      const filteredBody = {};

      Object.keys(preservedBody).forEach((key) => {
        if (allowedFields.includes(key)) {
          filteredBody[key] = preservedBody[key];
        } else {
          console.log(
            `🔍 DEBUG - FormDataBody - Filtrando campo no permitido: ${key}`,
          );
        }
      });

      booleanFields.forEach((field) => {
        if (filteredBody[field] !== undefined) {
          // Asegurar que sea string
          filteredBody[field] = String(filteredBody[field]);
          console.log(
            `🔍 DEBUG - FormDataBody - Preservando ${field} como string:`,
            filteredBody[field],
          );
        }
      });

      console.log('🔍 DEBUG - FormDataBody - Body preservado:', filteredBody);

      // Transformar a la clase DTO
      const dtoClass = data; // La clase DTO se pasa como parámetro
      if (dtoClass) {
        const dto = plainToClass(dtoClass, filteredBody, {
          enableImplicitConversion: false,
          excludeExtraneousValues: false,
        });

        console.log('🔍 DEBUG - FormDataBody - DTO transformado:', dto);

        // Validar el DTO
        const errors = await validate(dto as object);
        if (errors.length > 0) {
          console.log(
            '🔍 DEBUG - FormDataBody - Errores de validación:',
            errors,
          );
          throw new Error(
            `Validation failed: ${errors
              .map((e) => Object.values(e.constraints || {}))
              .flat()
              .join(', ')}`,
          );
        }

        return dto;
      }

      return filteredBody;
    }

    return body;
  },
);
