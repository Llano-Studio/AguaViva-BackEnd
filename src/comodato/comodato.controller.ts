import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PersonsService } from '../persons/persons.service';
import { ComodatoResponseDto } from '../persons/dto/comodato-response.dto';
import { FilterComodatosDto } from '../persons/dto/filter-comodatos.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('Comodatos')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE, Role.DRIVERS)
@Controller('comodatos')
export class ComodatoController {
  constructor(private readonly personsService: PersonsService) {}

  @Get('get-all-comodatos')
  @ApiOperation({
    summary: 'Obtener todos los comodatos del sistema con filtros avanzados',
    description: `Lista todos los comodatos registrados en el sistema con opciones de filtrado avanzado y búsqueda.

## 🎯 FUNCIONALIDAD PRINCIPAL

**Gestión Centralizada de Comodatos:**
- Vista global de todos los comodatos del sistema
- Filtrado por múltiples criterios simultáneamente
- Búsqueda por texto en nombres de clientes y productos
- Filtrado por estado, zona geográfica y fechas

## 📊 CASOS DE USO

**Ejemplos de consultas:**
- **Comodatos activos por zona**: \`?status=ACTIVE&zone_id=5\`
- **Productos específicos**: \`?product_id=1&status=ACTIVE\`
- **Búsqueda por cliente**: \`?customer_name=García\`
- **Comodatos vencidos**: \`?status=OVERDUE\`
- **Búsqueda general**: \`?search=dispensador\`

## 🔍 FILTROS DISPONIBLES

**Estados de Comodato:**
- \`ACTIVE\`: Comodatos activos en uso
- \`RETURNED\`: Comodatos devueltos
- \`OVERDUE\`: Comodatos vencidos
- \`CANCELLED\`: Comodatos cancelados

**Filtros Geográficos:**
- Por zona específica para análisis territorial
- Útil para planificación de rutas de retiro

**Búsquedas de Texto:**
- Nombre de cliente (parcial)
- Descripción de producto (parcial)
- Búsqueda general en múltiples campos`,
  })
  @ApiQuery({
    name: 'person_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID específico de persona/cliente',
    example: 15,
  })
  @ApiQuery({
    name: 'product_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID específico de producto en comodato',
    example: 3,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'RETURNED', 'OVERDUE', 'CANCELLED'],
    description: 'Filtrar por estado actual del comodato',
    example: 'ACTIVE',
  })
  @ApiQuery({
    name: 'zone_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID de zona geográfica del cliente',
    example: 2,
  })
  @ApiQuery({
    name: 'customer_name',
    required: false,
    type: String,
    description: 'Buscar por nombre del cliente (búsqueda parcial)',
    example: 'García',
  })
  @ApiQuery({
    name: 'product_name',
    required: false,
    type: String,
    description:
      'Buscar por nombre/descripción del producto (búsqueda parcial)',
    example: 'dispensador',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Búsqueda general en nombres de clientes, productos y notas',
    example: 'agua',
  })
  @ApiQuery({
    name: 'delivery_date_from',
    required: false,
    type: String,
    description: 'Filtrar comodatos entregados desde esta fecha (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'delivery_date_to',
    required: false,
    type: String,
    description: 'Filtrar comodatos entregados hasta esta fecha (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @ApiResponse({
    status: 200,
    description:
      'Lista de comodatos obtenida exitosamente con información detallada.',
    type: [ComodatoResponseDto],
    examples: {
      exitoso: {
        summary: 'Respuesta exitosa con comodatos',
        value: [
          {
            comodato_id: 1,
            person_id: 15,
            product_id: 3,
            quantity: 2,
            delivery_date: '2024-01-15T10:00:00.000Z',
            expected_return_date: '2024-02-15T10:00:00.000Z',
            actual_return_date: null,
            status: 'ACTIVE',
            notes: 'Dispensador de agua para oficina',
            contract_image_url: '/uploads/contracts/contrato-123.pdf',
            person: {
              person_id: 15,
              name: 'Juan García',
              address: 'Av. Principal 123',
              phone: '+54911234567',
              zone: {
                zone_id: 2,
                name: 'Zona Norte',
              },
            },
            product: {
              product_id: 3,
              description: 'Dispensador de Agua Fría/Caliente',
              volume_liters: 0,
              is_returnable: true,
            },
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token de acceso requerido.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Prohibido - El usuario no tiene permisos para acceder a comodatos.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Parámetros de consulta inválidos (ej: fechas mal formateadas, IDs negativos).',
  })
  async getAllComodatos(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        skipMissingProperties: true,
      }),
    )
    filters: FilterComodatosDto,
  ): Promise<ComodatoResponseDto[]> {
    return this.personsService.getAllComodatos(filters);
  }
}
