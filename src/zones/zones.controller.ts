import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseInterceptors,
  Query,
  Inject,
} from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ZonesService } from './zones.service';
import { CreateZoneDto, UpdateZoneDto, FilterZonesDto } from './dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { VehicleService } from '../vehicule/vehicle.service';

@ApiTags('Zonas')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
@Controller('zones')
export class ZonesController {
  constructor(
    private readonly zonesService: ZonesService,
    private readonly vehicleService: VehicleService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear nueva zona geográfica de entrega',
    description: `Crea una nueva zona geográfica para organización territorial y planificación logística.

## 🗺️ GESTIÓN TERRITORIAL

**Funcionalidad Principal:**
- Organización geográfica de clientes
- Planificación eficiente de rutas de entrega
- Asignación de vehículos por zona
- Control territorial de operaciones

## 📍 ESTRUCTURA JERÁRQUICA

**Relaciones Geográficas:**
- **País** → **Provincia** → **Localidad** → **Zona**
- Cada zona pertenece a una localidad específica
- Múltiples zonas pueden existir en la misma localidad
- Códigos únicos por localidad

## 🚚 PLANIFICACIÓN LOGÍSTICA

**Beneficios Operativos:**
- **Optimización de Rutas**: Agrupación geográfica de entregas
- **Asignación de Recursos**: Vehículos específicos por zona
- **Eficiencia de Combustible**: Reducción de distancias
- **Mejor Servicio**: Tiempos de entrega predecibles

## 🎯 CASOS DE USO

- **Expansión Territorial**: Nuevas áreas de cobertura
- **Reorganización Logística**: Optimización de zonas existentes
- **Asignación de Clientes**: Ubicación geográfica de servicios
- **Planificación de Rutas**: Base para hojas de ruta eficientes`,
  })
  @ApiBody({
    description: 'Datos de la zona a crear',
    type: CreateZoneDto,
    examples: {
      example1: {
        value: {
          name: 'Zona Centro',
          code: 'ZC-001',
          localityId: 1,
        },
      },
    },
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
    description: 'Datos de entrada inválidos o localidad no encontrada.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - Ya existe una zona con el mismo código en esta localidad.',
  })
  createZone(@Body() dto: CreateZoneDto) {
    return this.zonesService.createZone(dto);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Listar todas las zonas geográficas',
    description: `Obtiene un listado completo de todas las zonas geográficas disponibles en el sistema con capacidades avanzadas de filtrado y búsqueda.

## 🔍 FILTRADO AVANZADO

**Búsqueda Inteligente:**
- **search**: Búsqueda general por nombre de zona, código o nombre de localidad
- **name**: Filtro específico por nombre exacto de zona
- **locality_id**: Filtro por ID de localidad específica (compatibilidad)
- **locality_ids**: Filtro por múltiples localidades (formato: "1,2,3" o array [1,2,3])
- **locality_name**: Búsqueda parcial por nombre de localidad

**Ordenamiento Avanzado:**
- **sortBy**: Múltiples campos con dirección (ej: "name,-code" = nombre ascendente, código descendente)
- Campos disponibles: name, code, locality_id
- Prefijo "-" para orden descendente

## 📊 INFORMACIÓN INCLUIDA

**Datos de Zona:**
- ID único de zona
- Código identificador
- Nombre descriptivo
- Estado activo/inactivo

**Información Geográfica:**
- Datos completos de localidad asociada
- Información de provincia y país
- Jerarquía geográfica completa

**Metadatos de Paginación:**
- Total de registros
- Página actual y límite
- Total de páginas disponibles

## 🎯 CASOS DE USO

- **Gestión Territorial**: Administración de zonas de cobertura
- **Planificación Logística**: Asignación de rutas y vehículos por zona
- **Análisis Geográfico**: Estudios de distribución territorial
- **Reportes Gerenciales**: Informes de cobertura y operaciones
- **Administración**: Configuración y mantenimiento del sistema
- **Auditorías**: Verificación de estructura territorial`,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Búsqueda general por nombre, código de zona o nombre de localidad',
    example: 'norte',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filtrar por nombre de zona',
    example: 'Zona Norte',
  })
  @ApiQuery({
    name: 'locality_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID de localidad (para compatibilidad)',
    example: 1,
  })
  @ApiQuery({
    name: 'locality_ids',
    required: false,
    type: String,
    description:
      "Filtrar por IDs de localidades múltiples. Formato: '1,2,3' o array [1,2,3]",
    example: '1,2,3',
  })
  @ApiQuery({
    name: 'locality_name',
    required: false,
    type: String,
    description: 'Filtrar por nombre de localidad',
    example: 'Buenos Aires',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      "Campos para ordenar. Prefijo '-' para descendente. Ej: name,-code",
    example: 'name,-code',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número de página',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Resultados por página',
    example: 10,
  })
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
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  getAllZones(@Query() filters: FilterZonesDto) {
    return this.zonesService.getAllZones(filters);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de la Zona a consultar',
    example: 1,
  })
  @ApiOperation({
    summary: 'Obtener zona específica por ID',
    description: `Devuelve la información completa y detallada de una zona geográfica específica según su ID único.

## 📋 INFORMACIÓN DEVUELTA

**Identificación:**
- ID único de la zona
- Código identificador único
- Nombre descriptivo de la zona
- Estado de activación

**Detalles Operativos:**
- Código único para identificación rápida
- Nombre descriptivo para uso administrativo
- Características geográficas específicas
- Estado de disponibilidad operativa

**Información Geográfica Completa:**
- Datos completos de localidad asociada
- Información detallada de provincia
- Datos del país correspondiente
- Jerarquía territorial completa

## 🎯 CASOS DE USO

- **Consultas Específicas**: Obtener detalles de una zona particular
- **Validación de Asignaciones**: Verificar datos antes de asignar vehículos o rutas
- **Planificación de Entregas**: Consultar información para programación logística
- **Gestión Individual**: Administración detallada de zona específica
- **Verificación de Auditoría**: Validación de datos para procesos de control`,
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
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  getZoneById(@Param('id', ParseIntPipe) id: number) {
    return this.zonesService.getZoneById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de la Zona a actualizar',
    example: 1,
  })
  @ApiOperation({
    summary: 'Actualizar zona',
    description:
      'Actualiza la información de una zona existente. Solo se modifican los campos proporcionados en la solicitud. La zona puede cambiarse de localidad si se especifica un nuevo localityId.',
  })
  @ApiBody({
    description: 'Datos de la zona a actualizar',
    type: UpdateZoneDto,
    examples: {
      example1: {
        value: {
          name: 'Zona Centro Actualizada',
          localityId: 2,
        },
      },
    },
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
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o localidad no encontrada.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - Ya existe una zona con el mismo código en la localidad destino.',
  })
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
    example: 1,
  })
  @ApiOperation({
    summary: 'Eliminar zona',
    description:
      'Elimina una zona del sistema. No es posible eliminar zonas que tengan clientes, localidades u otros registros asociados.',
  })
  @ApiResponse({
    status: 200,
    description: 'Zona eliminada exitosamente',
    schema: {
      properties: {
        message: { type: 'string', example: 'Zona eliminada correctamente' },
        deleted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - La zona está en uso y no puede ser eliminada.',
  })
  deleteZoneById(@Param('id', ParseIntPipe) id: number) {
    return this.zonesService.deleteZoneById(id);
  }

  @Get(':id/vehicles')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de la zona',
    example: 1,
  })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Solo mostrar vehículos con asignaciones activas',
    example: true,
  })
  @ApiOperation({
    summary: 'Obtener vehículos que circulan en una zona',
    description:
      'Lista todos los vehículos que están asignados para circular en una zona específica.',
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
          description: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Zona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de ADMIN.',
  })
  getZoneVehicles(
    @Param('id', ParseIntPipe) zoneId: number,
    @Query('activeOnly') activeOnly?: boolean,
  ) {
    return this.vehicleService.getZoneVehicles(zoneId, activeOnly ?? true);
  }
}
