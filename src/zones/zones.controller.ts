import {
  Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseInterceptors, Query, Inject,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiQuery,
} from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { CreateZoneDto, UpdateZoneDto, FilterZonesDto } from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { VehicleService } from '../vehicule/vehicle.service';

@ApiTags('Zonas')
@ApiBearerAuth()
@Auth(Role.ADMIN, Role.USER)
@Controller('zones')
export class ZonesController {
  constructor(
    private readonly zonesService: ZonesService,
    private readonly vehicleService: VehicleService
  ) { }

  @Post()
  @ApiOperation({ 
    summary: 'Crear una zona', 
    description: 'Crea una nueva zona geográfica en el sistema. Las zonas pertenecen a una localidad específica y se utilizan para organizar clientes y planificar rutas de entrega. Pueden existir múltiples zonas con el mismo nombre en diferentes localidades.'
  })
  @ApiBody({
    description: 'Datos de la zona a crear',
    type: CreateZoneDto,
    examples: {
      example1: {
        value: {
          name: 'Zona Centro',
          code: 'ZC-001',
          localityId: 1
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Zona creada exitosamente', 
    schema: {
      properties: {
        zone_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Zona Centro' },
        code: { type: 'string', example: 'ZC-001' },
        locality_id: { type: 'number', example: 1 },
        locality: {
          properties: {
            locality_id: { type: 'number' },
            code: { type: 'string' },
            name: { type: 'string' },
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
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o localidad no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Ya existe una zona con el mismo código en esta localidad.' })
  createZone(
    @Body() dto: CreateZoneDto
  ) {
    return this.zonesService.createZone(dto);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ 
    summary: 'Listar todas las zonas',
    description: 'Obtiene un listado completo de todas las zonas disponibles en el sistema. Los resultados se almacenan en caché para mejorar el rendimiento.'
  })
  @ApiQuery({ name: 'search', required: false, type: String, description: "Búsqueda general por nombre, código de zona o nombre de localidad", example: 'norte' })
  @ApiQuery({ name: 'name', required: false, type: String, description: "Filtrar por nombre de zona", example: 'Zona Norte' })
  @ApiQuery({ name: 'locality_id', required: false, type: Number, description: "Filtrar por ID de localidad", example: 1 })
  @ApiQuery({ name: 'locality_name', required: false, type: String, description: "Filtrar por nombre de localidad", example: 'Buenos Aires' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: "Campos para ordenar. Prefijo '-' para descendente. Ej: name,-code", example: 'name,-code' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiResponse({ 
    status: 200, 
    description: 'Listado de zonas obtenido exitosamente', 
    schema: {
      properties: {
        data: { 
          type: 'array', 
          items: { 
            properties: {
              zone_id: { type: 'number' },
              name: { type: 'string' },
              code: { type: 'string' },
              locality: {
                type: 'array',
                items: {
                  properties: {
                    locality_id: { type: 'number' },
                    code: { type: 'string' },
                    name: { type: 'string' },
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
                    }
                  }
                }
              }
            }
          }
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  getAllZones(
    @Query() filters: FilterZonesDto,
  ) {
    return this.zonesService.getAllZones(filters);
  }

  @Get(':id')
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la Zona a consultar',
    example: 1
  })
  @ApiOperation({ 
    summary: 'Obtener zona por ID',
    description: 'Devuelve la información detallada de una zona específica según su ID, incluyendo datos relacionados.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Datos de la zona encontrados exitosamente', 
    schema: {
      properties: {
        zone_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Zona Norte' },
        code: { type: 'string', example: 'ZN-001' },
        localities: {
          type: 'array',
          items: {
            properties: {
              locality_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' },
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
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  getZoneById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.zonesService.getZoneById(id);
  }

  @Patch(':id')
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la Zona a actualizar',
    example: 1
  })
  @ApiOperation({ 
    summary: 'Actualizar zona',
    description: 'Actualiza la información de una zona existente. Solo se modifican los campos proporcionados en la solicitud. La zona puede cambiarse de localidad si se especifica un nuevo localityId.'
  })
  @ApiBody({
    description: 'Datos de la zona a actualizar',
    type: UpdateZoneDto,
    examples: {
      example1: {
        value: {
          name: 'Zona Centro Actualizada',
          localityId: 2
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Zona actualizada exitosamente', 
    schema: {
      properties: {
        zone_id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Zona Centro Actualizada' },
        code: { type: 'string', example: 'ZC-001' },
        locality_id: { type: 'number', example: 2 },
        locality: {
          properties: {
            locality_id: { type: 'number' },
            code: { type: 'string' },
            name: { type: 'string' },
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
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o localidad no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - Ya existe una zona con el mismo código en la localidad destino.' })
  updateZoneById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.zonesService.updateZoneById(id, dto);
  }

  @Delete(':id')
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la Zona a eliminar',
    example: 1
  })
  @ApiOperation({ 
    summary: 'Eliminar zona',
    description: 'Elimina una zona del sistema. No es posible eliminar zonas que tengan clientes, localidades u otros registros asociados.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Zona eliminada exitosamente',
    schema: {
      properties: {
        message: { type: 'string', example: 'Zona eliminada correctamente' },
        deleted: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - La zona está en uso y no puede ser eliminada.' })
  deleteZoneById(@Param('id', ParseIntPipe) id: number) {
    return this.zonesService.deleteZoneById(id);
  }

  @Get(':id/vehicles')
  @ApiParam({ 
    name: 'id', 
    type: Number, 
    description: 'ID de la zona',
    example: 1
  })
  @ApiQuery({ 
    name: 'activeOnly', 
    required: false, 
    type: Boolean, 
    description: 'Solo mostrar vehículos con asignaciones activas', 
    example: true 
  })
  @ApiOperation({ 
    summary: 'Obtener vehículos que circulan en una zona',
    description: 'Lista todos los vehículos que están asignados para circular en una zona específica.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de vehículos de la zona obtenida exitosamente',
    schema: {
      type: 'array',
      items: {
        properties: {
          vehicle_id: { type: 'number' },
          code: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  getZoneVehicles(
    @Param('id', ParseIntPipe) zoneId: number,
    @Query('activeOnly') activeOnly?: boolean
  ) {
    return this.vehicleService.getZoneVehicles(zoneId, activeOnly ?? true);
  }
}
