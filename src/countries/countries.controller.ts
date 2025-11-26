import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CountriesService } from './countries.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('🌍 Ubicaciones')
@ApiBearerAuth()
@Auth(
  Role.ADMINISTRATIVE,
  Role.SUPERADMIN,
  Role.BOSSADMINISTRATIVE,
  Role.DRIVERS,
)
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Listar todos los países',
    description:
      'Obtiene un listado completo de todos los países disponibles en el sistema, incluyendo sus provincias y localidades.',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de países obtenido exitosamente',
    schema: {
      type: 'array',
      items: {
        properties: {
          country_id: { type: 'number', example: 1 },
          code: { type: 'string', example: 'AR' },
          name: { type: 'string', example: 'Argentina' },
          province: {
            type: 'array',
            items: {
              properties: {
                province_id: { type: 'number' },
                code: { type: 'string' },
                name: { type: 'string' },
                locality: {
                  type: 'array',
                  items: {
                    properties: {
                      locality_id: { type: 'number' },
                      code: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Token inválido o expirado' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'No tienes permisos para acceder a este recurso',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  findAll() {
    return this.countriesService.findAll();
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID del País a consultar',
    example: 1,
  })
  @ApiOperation({
    summary: 'Obtener país por ID',
    description:
      'Devuelve la información detallada de un país específico según su ID, incluyendo todas sus provincias y localidades.',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos del país encontrados exitosamente',
    schema: {
      properties: {
        country_id: { type: 'number', example: 1 },
        code: { type: 'string', example: 'AR' },
        name: { type: 'string', example: 'Argentina' },
        province: {
          type: 'array',
          items: {
            properties: {
              province_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' },
              locality: {
                type: 'array',
                items: {
                  properties: {
                    locality_id: { type: 'number' },
                    code: { type: 'string' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'ID de país inválido',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'El ID debe ser un número válido' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Token inválido o expirado' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'No tienes permisos para acceder a este recurso',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'País no encontrado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'País con ID 123 no encontrado' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.countriesService.findById(id);
  }
}
