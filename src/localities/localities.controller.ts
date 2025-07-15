import {
  Controller, Get, Param, ParseIntPipe, UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth,
} from '@nestjs/swagger';
import { LocalitiesService } from './localities.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Localidades')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
@Controller('localities')
export class LocalitiesController {
  constructor(private readonly localitiesService: LocalitiesService) { }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ 
    summary: 'Listar todas las localidades',
    description: 'Obtiene un listado completo de todas las localidades disponibles en el sistema, incluyendo información de provincia, país y zona.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Listado de localidades obtenido exitosamente', 
    schema: {
      type: 'array',
      items: {
        properties: {
          locality_id: { type: 'number', example: 1 },
          code: { type: 'string', example: 'RES' },
          name: { type: 'string', example: 'Resistencia' },
          province_id: { type: 'number', example: 1 },
          zone_id: { type: 'number', example: 1, nullable: true },
          province: {
            properties: {
              province_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' },
              country: {
                properties: {
                  country_id: { type: 'number' },
                  code: { type: 'string' },
                  name: { type: 'string' }
                }
              }
            }
          },
          zone: {
            properties: {
              zone_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' }
            },
            nullable: true
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene los permisos necesarios.' })
  findAll() {
    return this.localitiesService.findAll();
  }

  @Get(':id')
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la Localidad a consultar',
    example: 1
  })
  @ApiOperation({ 
    summary: 'Obtener localidad por ID',
    description: 'Devuelve la información detallada de una localidad específica según su ID, incluyendo información de provincia, país y zona.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Datos de la localidad encontrados exitosamente', 
    schema: {
      properties: {
        locality_id: { type: 'number', example: 1 },
        code: { type: 'string', example: 'RES' },
        name: { type: 'string', example: 'Resistencia' },
        province_id: { type: 'number', example: 1 },
        zone_id: { type: 'number', example: 1, nullable: true },
        province: {
          properties: {
            province_id: { type: 'number' },
            code: { type: 'string' },
            name: { type: 'string' },
            country: {
              properties: {
                country_id: { type: 'number' },
                code: { type: 'string' },
                name: { type: 'string' }
              }
            }
          }
        },
        zone: {
          properties: {
            zone_id: { type: 'number' },
            code: { type: 'string' },
            name: { type: 'string' }
          },
          nullable: true
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Localidad no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene los permisos necesarios.' })
  findById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.localitiesService.findById(id);
  }
} 