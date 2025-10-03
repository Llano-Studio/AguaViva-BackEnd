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
import { ProvincesService } from './provinces.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Provincias')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
@Controller('provinces')
export class ProvincesController {
  constructor(private readonly provincesService: ProvincesService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Listar todas las provincias',
    description: `Obtiene un listado completo de todas las provincias disponibles en el sistema con información geográfica jerárquica completa.

## 🗺️ INFORMACIÓN GEOGRÁFICA

**Datos Incluidos:**
- **Provincia**: ID, código, nombre y metadatos
- **País**: Información completa del país contenedor
- **Localidades**: Listado completo de localidades por provincia
- **Jerarquía**: Estructura territorial organizada

## 🔄 OPTIMIZACIÓN DE RENDIMIENTO

**Características Técnicas:**
- **Cache Automático**: Respuestas cacheadas para mejor rendimiento
- **Ordenamiento**: Listado alfabético por nombre de provincia
- **Relaciones Incluidas**: Datos completos en una sola consulta
- **Estructura Optimizada**: Información jerárquica eficiente

## 📊 ESTRUCTURA DE RESPUESTA

**Organización Territorial:**
- **País** → **Provincia** → **Localidad**
- Relaciones padre-hijo claramente definidas
- Información completa de cada nivel
- Metadatos de ubicación geográfica

## 🎯 CASOS DE USO

- **Selección Geográfica**: Formularios de ubicación y registro
- **Gestión Territorial**: Administración de cobertura por provincia
- **Planificación Regional**: Organización de operaciones por provincia
- **Reportes Geográficos**: Análisis y estadísticas por región
- **Configuración de Sistema**: Setup inicial de ubicaciones
- **Integración de APIs**: Datos para sistemas externos
- **Análisis de Mercado**: Estudios de penetración por provincia`,
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
              name: { type: 'string' },
            },
          },
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
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios.',
  })
  findAll() {
    return this.provincesService.findAll();
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de la Provincia a consultar',
    example: 1,
  })
  @ApiOperation({
    summary: 'Obtener provincia por ID',
    description: `Devuelve la información detallada de una provincia específica con toda su estructura territorial y relaciones geográficas.

## 🔍 INFORMACIÓN DETALLADA

**Datos de Provincia:**
- **Identificación**: ID único, código y nombre oficial
- **País**: Información completa del país contenedor
- **Localidades**: Listado completo de todas las localidades
- **Metadatos**: Información adicional de ubicación

**Estructura Territorial:**
- **Jerarquía Completa**: País → Provincia → Localidades
- **Relaciones Geográficas**: Vínculos territoriales definidos
- **Cobertura Regional**: Alcance geográfico completo
- **Organización Administrativa**: Estructura gubernamental

## 📊 ESTRUCTURA DE RESPUESTA

**Datos Principales:**
- Información completa de la provincia solicitada
- Datos del país asociado
- Listado completo de localidades contenidas
- Metadatos de ubicación geográfica

## 🎯 CASOS DE USO

- **Consultas Específicas**: Información detallada de una provincia
- **Análisis Regional**: Estudios específicos por provincia
- **Gestión de Localidades**: Base para administración territorial
- **Formularios de Edición**: Carga de datos para modificación
- **Reportes Provinciales**: Información específica por región
- **Planificación Logística**: Organización de operaciones regionales
- **Validación de Datos**: Verificación de existencia y estructura
- **Integración de Sistemas**: Consulta de datos para APIs externas`,
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
            name: { type: 'string' },
          },
        },
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
  })
  @ApiResponse({ status: 404, description: 'Provincia no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios.',
  })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.provincesService.findById(id);
  }
}
