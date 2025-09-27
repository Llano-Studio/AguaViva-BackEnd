import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
  ApiBody,
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
  constructor(private readonly localitiesService: LocalitiesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una nueva localidad',
    description: `Crea una nueva localidad en el sistema para organización territorial y gestión geográfica.

## 🗺️ GESTIÓN TERRITORIAL

**Estructura Jerárquica:**
- **País** → **Provincia** → **Localidad** → **Zona**
- Cada localidad pertenece a una provincia específica
- Base para la creación de zonas de entrega
- Códigos únicos a nivel sistema

## 📋 VALIDACIONES AUTOMÁTICAS

**Controles de Integridad:**
- **Provincia Existente**: Verificación de ID de provincia válido
- **Código Único**: No duplicación de códigos en el sistema
- **Formato de Datos**: Validación de longitud y caracteres
- **Relaciones Consistentes**: Integridad referencial

## 📊 INFORMACIÓN INCLUIDA

**Datos de Respuesta:**
- Información completa de la localidad creada
- Datos de provincia y país asociados
- Zonas existentes en la localidad (si las hay)
- Metadatos de creación

## 🎯 CASOS DE USO

- **Expansión Geográfica**: Nuevas áreas de cobertura
- **Organización Territorial**: Estructura administrativa
- **Base para Zonas**: Preparación para división en zonas
- **Gestión de Clientes**: Ubicación geográfica de servicios
- **Planificación Logística**: Fundamento para rutas de entrega`,
  })
  @ApiBody({
    description: 'Datos de la localidad a crear',
    type: CreateLocalityDto,
    examples: {
      example1: {
        value: {
          code: 'RES',
          name: 'Resistencia',
          provinceId: 1,
        },
      },
    },
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
                name: { type: 'string' },
              },
            },
          },
        },
        zones: {
          type: 'array',
          items: {
            properties: {
              zone_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o provincia no encontrada.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - Ya existe una localidad con el mismo código.',
  })
  create(@Body() dto: CreateLocalityDto) {
    return this.localitiesService.create(dto);
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({
    summary: 'Listar todas las localidades',
    description: `Obtiene un listado completo de todas las localidades disponibles en el sistema con información geográfica completa.

## 🗺️ INFORMACIÓN GEOGRÁFICA

**Datos Incluidos:**
- **Localidad**: ID, código, nombre y estado
- **Provincia**: Información completa de provincia asociada
- **País**: Datos del país correspondiente
- **Zonas**: Listado de zonas dentro de cada localidad

## 🔄 OPTIMIZACIÓN DE RENDIMIENTO

**Características Técnicas:**
- **Cache Automático**: Respuestas cacheadas para mejor rendimiento
- **Solo Activas**: Filtrado automático de localidades activas
- **Ordenamiento**: Listado alfabético por nombre
- **Relaciones Incluidas**: Datos completos en una sola consulta

## 📊 ESTRUCTURA DE RESPUESTA

**Jerarquía Geográfica:**
- Organización territorial completa
- Relaciones padre-hijo claramente definidas
- Información de zonas asociadas
- Metadatos de ubicación

## 🎯 CASOS DE USO

- **Selección de Ubicación**: Formularios de registro y configuración
- **Gestión Territorial**: Administración de cobertura geográfica
- **Planificación Logística**: Base para organización de rutas
- **Reportes Geográficos**: Análisis por ubicación
- **Configuración de Zonas**: Preparación para división territorial
- **Integración de Sistemas**: APIs para sistemas externos`,
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
                  name: { type: 'string' },
                },
              },
            },
          },
          zone: {
            properties: {
              zone_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' },
            },
            nullable: true,
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
    return this.localitiesService.findAll();
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de la Localidad a consultar',
    example: 1,
  })
  @ApiOperation({
    summary: 'Obtener localidad por ID',
    description: `Devuelve la información detallada de una localidad específica con toda su información geográfica y relaciones.

## 🔍 INFORMACIÓN DETALLADA

**Datos de Localidad:**
- **Identificación**: ID único, código y nombre
- **Estado**: Indicador de actividad
- **Relaciones**: Provincia y país asociados
- **Zonas**: Listado completo de zonas dentro de la localidad

**Información Geográfica:**
- **Provincia**: Datos completos de la provincia contenedora
- **País**: Información del país correspondiente
- **Jerarquía**: Estructura territorial completa

## 📊 ESTRUCTURA DE RESPUESTA

**Datos Principales:**
- Información completa de la localidad solicitada
- Relaciones geográficas incluidas
- Zonas asociadas (si existen)
- Metadatos de ubicación

## 🎯 CASOS DE USO

- **Consultas Específicas**: Información detallada de una localidad
- **Validación de Datos**: Verificación de existencia y estado
- **Gestión de Zonas**: Base para administración de zonas
- **Formularios de Edición**: Carga de datos para modificación
- **Reportes Detallados**: Información específica por localidad
- **Integración de Sistemas**: Consulta de datos para APIs externas`,
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
                name: { type: 'string' },
              },
            },
          },
        },
        zone: {
          properties: {
            zone_id: { type: 'number' },
            code: { type: 'string' },
            name: { type: 'string' },
          },
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Localidad no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios.',
  })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.localitiesService.findById(id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de la Localidad a actualizar',
    example: 1,
  })
  @ApiOperation({
    summary: 'Actualizar localidad',
    description: `Actualiza la información de una localidad existente con validaciones automáticas y control de integridad.

## ✏️ CAMPOS ACTUALIZABLES

**Información Básica:**
- **code**: Código identificador único
- **name**: Nombre descriptivo de la localidad
- **provinceId**: Cambio de provincia (reasignación territorial)

## 📋 VALIDACIONES AUTOMÁTICAS

**Controles de Integridad:**
- **Existencia**: Verificación de localidad existente
- **Código Único**: No duplicación en el sistema
- **Provincia Válida**: Verificación de provincia de destino
- **Actualización Parcial**: Solo campos proporcionados

**Reglas de Negocio:**
- Códigos únicos a nivel sistema
- Provincias deben existir antes de asignación
- Preservación de relaciones existentes
- Mantenimiento de zonas asociadas

## 📊 INFORMACIÓN DE RESPUESTA

**Datos Actualizados:**
- Información completa de la localidad modificada
- Datos de nueva provincia (si cambió)
- Zonas asociadas mantenidas
- Metadatos de actualización

## 🎯 CASOS DE USO

- **Corrección de Datos**: Actualización de información incorrecta
- **Reorganización Territorial**: Cambio de provincia
- **Estandarización**: Normalización de códigos y nombres
- **Mantenimiento**: Actualización de datos obsoletos
- **Migración de Datos**: Reasignación territorial masiva`,
  })
  @ApiBody({
    description: 'Datos de la localidad a actualizar',
    type: UpdateLocalityDto,
    examples: {
      example1: {
        value: {
          name: 'Resistencia Actualizada',
          provinceId: 2,
        },
      },
    },
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
                name: { type: 'string' },
              },
            },
          },
        },
        zones: {
          type: 'array',
          items: {
            properties: {
              zone_id: { type: 'number' },
              code: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Localidad no encontrada.' })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o provincia no encontrada.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - Ya existe una localidad con el mismo código.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocalityDto,
  ) {
    return this.localitiesService.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de la Localidad a eliminar',
    example: 1,
  })
  @ApiOperation({
    summary: 'Eliminar localidad',
    description: `Elimina una localidad del sistema con validaciones estrictas de integridad referencial.

## ⚠️ RESTRICCIONES DE ELIMINACIÓN

**Validaciones Automáticas:**
- **Zonas Asociadas**: No se puede eliminar si tiene zonas
- **Personas Registradas**: No se puede eliminar si tiene clientes/empleados
- **Almacenes**: No se puede eliminar si tiene almacenes asociados
- **Otros Registros**: Verificación de dependencias del sistema

## 🔒 CONTROLES DE INTEGRIDAD

**Verificaciones Previas:**
- **Existencia**: Confirmación de localidad existente
- **Dependencias**: Análisis completo de relaciones
- **Estado Activo**: Verificación de estado actual
- **Impacto del Sistema**: Evaluación de consecuencias

**Reglas de Negocio:**
- Solo localidades sin dependencias pueden eliminarse
- Eliminación lógica vs física según configuración
- Preservación de integridad referencial
- Auditoría de cambios críticos

## 📊 RESPUESTA DE CONFIRMACIÓN

**Datos de Respuesta:**
- **message**: Confirmación de eliminación exitosa
- **deleted**: Indicador booleano de eliminación
- **timestamp**: Momento de la operación
- **affected_records**: Registros impactados (si aplica)

## 🎯 CASOS DE USO

- **Limpieza de Datos**: Eliminación de localidades obsoletas
- **Corrección de Errores**: Remoción de registros incorrectos
- **Reorganización Territorial**: Consolidación de localidades
- **Mantenimiento del Sistema**: Limpieza de datos no utilizados
- **Migración de Datos**: Preparación para nuevas estructuras

## ⚡ ALTERNATIVAS RECOMENDADAS

- **Desactivación**: Marcar como inactiva en lugar de eliminar
- **Fusión**: Combinar con otra localidad existente
- **Migración**: Mover dependencias antes de eliminar`,
  })
  @ApiResponse({
    status: 200,
    description: 'Localidad eliminada exitosamente',
    schema: {
      properties: {
        message: {
          type: 'string',
          example: 'Localidad eliminada correctamente',
        },
        deleted: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Localidad no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene los permisos necesarios.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto - La localidad está en uso y no puede ser eliminada.',
  })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.localitiesService.delete(id);
  }
}
