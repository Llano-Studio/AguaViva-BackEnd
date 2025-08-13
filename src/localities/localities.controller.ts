import {
  Controller, Get, Post, Patch, Delete, Param, Body, ParseIntPipe, UseInterceptors,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody,
} from '@nestjs/swagger';
import { LocalitiesService } from './localities.service';
import { CreateLocalityDto, UpdateLocalityDto } from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Localidades')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
@Controller('localities')
export class LocalitiesController {
  constructor(private readonly localitiesService: LocalitiesService) { }

  @Post()
  @ApiOperation({ 
    summary: 'Crear una nueva localidad',
    description: 'Crea una nueva localidad en el sistema. La localidad debe pertenecer a una provincia existente y tener un código único.'
  })
  @ApiBody({
    description: 'Datos de la localidad a crear',
    type: CreateLocalityDto,
    examples: {
      example1: {
        value: {
          code: 'RES',
          name: 'Resistencia',
          provinceId: 1
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Localidad creada exitosamente', 
    schema: {
      properties: {
        locality_id: { type: 'number', example: 1 },
        code: { type: 'string', example: 'RES' },
        name: { type: 'string', example: 'Resistencia' },
        province_id: { type: 'number', example: 1 },
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
        zones: {
          type: 'array',
          items: {
            properties: {
              zone_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o provincia no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene los permisos necesarios.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Ya existe una localidad con el mismo código.' })
  create(@Body() dto: CreateLocalityDto) {
    return this.localitiesService.create(dto);
  }

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

  @Patch(':id')
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la Localidad a actualizar',
    example: 1
  })
  @ApiOperation({ 
    summary: 'Actualizar localidad',
    description: 'Actualiza la información de una localidad existente. Solo se modifican los campos proporcionados en la solicitud. La localidad puede cambiarse de provincia si se especifica un nuevo provinceId.'
  })
  @ApiBody({
    description: 'Datos de la localidad a actualizar',
    type: UpdateLocalityDto,
    examples: {
      example1: {
        value: {
          name: 'Resistencia Actualizada',
          provinceId: 2
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Localidad actualizada exitosamente', 
    schema: {
      properties: {
        locality_id: { type: 'number', example: 1 },
        code: { type: 'string', example: 'RES' },
        name: { type: 'string', example: 'Resistencia Actualizada' },
        province_id: { type: 'number', example: 2 },
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
        zones: {
          type: 'array',
          items: {
            properties: {
              zone_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Localidad no encontrada.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o provincia no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene los permisos necesarios.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Ya existe una localidad con el mismo código.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocalityDto
  ) {
    return this.localitiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la Localidad a eliminar',
    example: 1
  })
  @ApiOperation({ 
    summary: 'Eliminar localidad',
    description: 'Elimina una localidad del sistema. No es posible eliminar localidades que tengan zonas, personas, almacenes u otros registros asociados.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Localidad eliminada exitosamente',
    schema: {
      properties: {
        message: { type: 'string', example: 'Localidad eliminada correctamente' },
        deleted: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Localidad no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene los permisos necesarios.' })
  @ApiResponse({ status: 409, description: 'Conflicto - La localidad está en uso y no puede ser eliminada.' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.localitiesService.delete(id);
  }
}