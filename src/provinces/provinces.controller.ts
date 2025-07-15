import {
  Controller, Get, Param, ParseIntPipe, UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth,
} from '@nestjs/swagger';
import { ProvincesService } from './provinces.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Provincias')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
@Controller('provinces')
export class ProvincesController {
  constructor(private readonly provincesService: ProvincesService) { }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ 
    summary: 'Listar todas las provincias',
    description: 'Obtiene un listado completo de todas las provincias disponibles en el sistema, incluyendo información del país y localidades.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Listado de provincias obtenido exitosamente', 
    schema: {
      type: 'array',
      items: {
        properties: {
          province_id: { type: 'number', example: 1 },
          code: { type: 'string', example: 'CH' },
          name: { type: 'string', example: 'Chaco' },
          country_id: { type: 'number', example: 1 },
          country: {
            properties: {
              country_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' }
            }
          },
          locality: {
            type: 'array',
            items: {
              properties: {
                locality_id: { type: 'number' },
                code: { type: 'string' },
                name: { type: 'string' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene los permisos necesarios.' })
  findAll() {
    return this.provincesService.findAll();
  }

  @Get(':id')
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la Provincia a consultar',
    example: 1
  })
  @ApiOperation({ 
    summary: 'Obtener provincia por ID',
    description: 'Devuelve la información detallada de una provincia específica según su ID, incluyendo información del país y todas sus localidades.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Datos de la provincia encontrados exitosamente', 
    schema: {
      properties: {
        province_id: { type: 'number', example: 1 },
        code: { type: 'string', example: 'CH' },
        name: { type: 'string', example: 'Chaco' },
        country_id: { type: 'number', example: 1 },
        country: {
          properties: {
            country_id: { type: 'number' },
            code: { type: 'string' },
            name: { type: 'string' }
          }
        },
        locality: {
          type: 'array',
          items: {
            properties: {
              locality_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Provincia no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene los permisos necesarios.' })
  findById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.provincesService.findById(id);
  }
} 