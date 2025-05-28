import {
  Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseInterceptors, Query,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiBody, ApiQuery,
} from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { CreateZoneDto, UpdateZoneDto, FilterZonesDto } from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Zonas')
@ApiBearerAuth()
@Auth(Role.ADMIN)
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) { }

  @Post()
  @ApiOperation({ 
    summary: 'Crear una zona', 
    description: 'Crea una nueva zona geográfica en el sistema. Las zonas se utilizan para organizar clientes y planificar rutas de entrega.'
  })
  @ApiBody({
    description: 'Datos de la zona a crear',
    type: CreateZoneDto,
    examples: {
      example1: {
        value: {
          name: 'Zona Norte',
          code: 'ZN-001',
          description: 'Zona norte de la ciudad',
          active: true
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Zona creada exitosamente', 
    schema: {
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Zona Norte' },
        code: { type: 'string', example: 'ZN-001' },
        description: { type: 'string', example: 'Zona norte de la ciudad', nullable: true },
        active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código de la zona ya existe.' })
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
  @ApiQuery({ name: 'name', required: false, type: String, description: "Filtrar por nombre de zona", example: 'Zona Norte' })
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
              id: { type: 'number' },
              name: { type: 'string' },
              code: { type: 'string' },
              description: { type: 'string', nullable: true },
              active: { type: 'boolean' },
            }
          }
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' }
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
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Zona Norte' },
        code: { type: 'string', example: 'ZN-001' },
        description: { type: 'string', example: 'Zona norte de la ciudad', nullable: true },
        active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
        localities: {
          type: 'array',
          items: {
            properties: {
              id: { type: 'number' },
              name: { type: 'string' }
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
    description: 'Actualiza la información de una zona existente. Solo se modifican los campos proporcionados en la solicitud.'
  })
  @ApiBody({
    description: 'Datos de la zona a actualizar',
    type: UpdateZoneDto,
    examples: {
      example1: {
        value: {
          name: 'Zona Norte Actualizada',
          description: 'Nueva descripción para la zona norte',
          active: true
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Zona actualizada exitosamente', 
    schema: {
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Zona Norte Actualizada' },
        code: { type: 'string', example: 'ZN-001' },
        description: { type: 'string', example: 'Nueva descripción para la zona norte', nullable: true },
        active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  @ApiResponse({ status: 409, description: 'Conflicto - El código de la zona ya está en uso.' })
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
}
