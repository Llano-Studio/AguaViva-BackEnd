import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiProperty,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonResponseDto } from './dto/person-response.dto';
import { Auth } from '../auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { PersonType } from '../common/constants/enums';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { ChangeContractPriceListDto } from './dto/change-contract-price-list.dto';
import { CancelSubscriptionDto } from './dto/cancel-subscription.dto';
import { FilterPersonsDto } from './dto/filter-persons.dto';
import { BUSINESS_CONFIG } from '../common/config/business.config';
import { LoanedProductDetailDto } from './dto/person-response.dto';
import {
  CreateComodatoDto,
  UpdateComodatoDto,
  FilterComodatosDto,
  ComodatoResponseDto,
  CreateSubscriptionWithComodatoDto,
} from './dto';
import { WithdrawComodatoDto } from './dto/withdraw-comodato.dto';
import { WithdrawComodatoResponseDto } from './dto/withdraw-comodato-response.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  fileUploadConfigs,
  buildImageUrl,
} from '../common/utils/file-upload.util';
import { CleanupFileOnErrorInterceptor } from '../common/interceptors/validate-before-upload.interceptor';

class PaginatedPersonsResponseDto {
  @ApiProperty({ type: [PersonResponseDto] })
  data: PersonResponseDto[];

  @ApiProperty({
    type: 'object',
    properties: {
      total: {
        type: 'number',
        example: 100,
        description: 'Total de personas disponibles',
      },
      page: {
        type: 'number',
        example: 1,
        description: 'Número de la página actual',
      },
      limit: {
        type: 'number',
        example: 10,
        description: 'Número de personas por página',
      },
      totalPages: {
        type: 'number',
        example: 10,
        description: 'Total de páginas disponibles',
      },
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@ApiTags('👥 Clientes')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Post()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Registrar nuevo cliente en el sistema',
    description: `Registra un nuevo cliente con toda su información personal y comercial para gestión integral.

## 👤 GESTIÓN DE CLIENTES

**Información Personal:**
- Datos de identificación completos
- Información de contacto
- Dirección y ubicación geográfica
- Tipo de cliente (individual, empresa, etc.)

## 📍 UBICACIÓN GEOGRÁFICA

**Asignación Territorial:**
- Localidad y zona de entrega
- Optimización de rutas logísticas
- Planificación de servicios por área
- Control territorial de operaciones

## 💼 TIPOS DE CLIENTE

**Categorías Disponibles:**
- **INDIVIDUAL**: Clientes particulares
- **PLAN**: Clientes con planes especiales
- **CORPORATIVO**: Empresas y organizaciones
- **MAYORISTA**: Distribuidores y revendedores

## 🎯 CASOS DE USO

- **Nuevos Clientes**: Registro inicial para servicios
- **Expansión Comercial**: Incorporación de nuevos mercados
- **Gestión Territorial**: Organización por zonas de entrega
- **Segmentación**: Clasificación para ofertas personalizadas`,
  })
  @ApiResponse({
    status: 201,
    description: 'Cliente registrado exitosamente en el sistema',
    type: PersonResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o error de validación en campos requeridos',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto: CUIT/Email ya existe en el sistema',
  })
  createPerson(
    @Body(ValidationPipe) dto: CreatePersonDto,
  ): Promise<PersonResponseDto> {
    return this.personsService.createPerson(dto);
  }

  @Get()
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Listar personas con filtros y paginación',
    description: `Obtiene un listado paginado de clientes con opciones de filtrado avanzado y búsqueda inteligente.

## 🔍 BÚSQUEDA INTELIGENTE

**Búsqueda General:**
- Búsqueda unificada por nombre, dirección, teléfono o CUIT/CUIL/DNI
- Búsqueda parcial y tolerante a errores
- Resultados ordenados por relevancia

## 📊 FILTROS AVANZADOS

**Filtros Geográficos:**
- **Por Localidad**: Filtrado por una o múltiples localidades
- **Por Zona**: Filtrado por zonas de entrega específicas
- **Combinados**: Filtros geográficos múltiples para optimización de rutas

**Filtros Comerciales:**
- **Tipo de Cliente**: Individual, Plan, Corporativo, Mayorista
- **Estado de Pagos**: Semáforo de pagos (Verde, Amarillo, Rojo)
- **Información Personal**: Nombre, dirección, teléfono, CUIT

## 🚦 SEMÁFORO DE PAGOS

**Estados Disponibles:**
- **VERDE**: Cliente al día con pagos
- **AMARILLO**: Cliente con atrasos menores
- **ROJO**: Cliente con atrasos significativos
- **NONE**: Sin información de pagos

## 📈 CASOS DE USO

- **Gestión Comercial**: Listado de clientes por zona o tipo
- **Cobranzas**: Filtrado por estado de pagos
- **Logística**: Organización por ubicación geográfica
- **Análisis**: Segmentación de clientes para reportes
- **Búsqueda Rápida**: Localización de clientes específicos`,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Búsqueda general por nombre, dirección, teléfono o CUIT/CUIL/DNI',
  })
  @ApiQuery({
    name: 'personId',
    required: false,
    type: Number,
    description: 'Filtrar por ID de persona',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: 'Filtrar por nombre (parcial)',
  })
  @ApiQuery({
    name: 'address',
    required: false,
    type: String,
    description: 'Filtrar por dirección (parcial)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: PersonType,
    description: 'Filtrar por tipo de persona (para compatibilidad)',
  })
  @ApiQuery({
    name: 'types',
    required: false,
    type: String,
    description:
      'Filtrar por tipos de persona múltiples. Formato: "INDIVIDUAL,PLAN" o array',
  })
  @ApiQuery({
    name: 'phone',
    required: false,
    type: String,
    description: 'Filtrar por teléfono (parcial)',
  })
  @ApiQuery({
    name: 'taxId',
    required: false,
    type: String,
    description: 'Filtrar por CUIT/CUIL/DNI (parcial)',
  })
  @ApiQuery({
    name: 'localityId',
    required: false,
    type: Number,
    description: 'Filtrar por ID de localidad (para compatibilidad)',
  })
  @ApiQuery({
    name: 'localityIds',
    required: false,
    type: String,
    description:
      'Filtrar por IDs de localidades múltiples. Formato: "1,2,3" o array [1,2,3]',
  })
  @ApiQuery({
    name: 'zoneId',
    required: false,
    type: Number,
    description: 'Filtrar por ID de zona (para compatibilidad)',
  })
  @ApiQuery({
    name: 'zoneIds',
    required: false,
    type: String,
    description:
      'Filtrar por IDs de zonas múltiples. Formato: "1,2,3" o array [1,2,3]',
  })
  @ApiQuery({
    name: 'payment_semaphore_status',
    required: false,
    type: String,
    description:
      'Filtrar por estado del semáforo de pagos (NONE, GREEN, YELLOW, RED) - para compatibilidad',
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED'],
  })
  @ApiQuery({
    name: 'payment_semaphore_statuses',
    required: false,
    type: String,
    description:
      'Filtrar por estados del semáforo múltiples. Formato: "GREEN,YELLOW" o array',
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED'],
  })
  @ApiQuery({
    name: 'is_active_values',
    required: false,
    type: String,
    description:
      'Filtrar por múltiples estados activos/inactivos. Acepta "true,false", "true%false" o array',
    example: 'true,false',
  })
  @ApiQuery({
    name: 'is_active',
    required: false,
    type: Boolean,
    description:
      'Filtrar por estado activo/inactivo. Por defecto muestra solo activos (true). También se acepta alias isActive/active.',
    example: false,
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
    example: BUSINESS_CONFIG.PAGINATION.DEFAULT_LIMIT,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      "Campos para ordenar. Prefijo '-' para descendente. Incluye payment_semaphore_status. Ej: name,-payment_semaphore_status,registrationDate",
    example: 'name,-payment_semaphore_status',
  })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado de personas',
    type: PaginatedPersonsResponseDto,
  })
  findAllPersons(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filters: FilterPersonsDto,
  ): Promise<PaginatedPersonsResponseDto> {
    return this.personsService.findAllPersons(filters);
  }

  @Get(':id')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiParam({ name: 'id', type: Number, description: 'ID de la persona' })
  @ApiOperation({
    summary: 'Obtener una persona por ID',
    description: `Obtiene los datos completos de un cliente específico incluyendo toda su información comercial y relacional.

## 👤 INFORMACIÓN INCLUIDA

**Datos Personales:**
- Información de identificación completa
- Datos de contacto y ubicación
- Tipo de cliente y clasificación

**Información Comercial:**
- Suscripciones activas y historial
- Contratos vigentes y cancelados
- Estado de pagos y semáforo comercial
- Productos en comodato

**Datos Relacionales:**
- Localidad y zona asignada
- Historial de pedidos
- Información de facturación

## 🎯 CASOS DE USO

- **Atención al Cliente**: Consulta completa de información
- **Gestión Comercial**: Revisión de estado del cliente
- **Soporte Técnico**: Verificación de productos y servicios
- **Cobranzas**: Análisis de estado de pagos
- **Logística**: Información para entregas y servicios`,
  })
  @ApiResponse({
    status: 200,
    description: 'Datos completos de la persona obtenidos exitosamente',
    type: PersonResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Persona no encontrada con el ID especificado',
  })
  findPersonById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PersonResponseDto> {
    return this.personsService.findPersonById(id);
  }

  @Patch(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Actualizar datos de una persona' })
  @ApiResponse({
    status: 200,
    description: 'Persona actualizada',
    type: PersonResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o error de validación',
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  @ApiResponse({
    status: 409,
    description: 'Conflicto, ej: CUIT/Email ya existe en otra persona',
  })
  updatePerson(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdatePersonDto,
  ): Promise<PersonResponseDto> {
    return this.personsService.updatePerson(id, dto);
  }

  @Delete(':id')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Eliminar una persona' })
  @ApiResponse({
    status: 200,
    description: 'Persona eliminada',
    schema: {
      properties: { message: { type: 'string' }, deleted: { type: 'boolean' } },
    },
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto, la persona tiene datos asociados (pedidos, contratos, etc.)',
  })
  deletePerson(@Param('id', ParseIntPipe) id: number) {
    return this.personsService.deletePerson(id);
  }

  @Patch(':personId/subscriptions/:subscriptionId/cancel')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({ summary: 'Cancelar una suscripción de un cliente' })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona (cliente)',
  })
  @ApiParam({
    name: 'subscriptionId',
    type: Number,
    description: 'ID de la suscripción a cancelar',
  })
  @ApiResponse({
    status: 200,
    description: 'Suscripción cancelada exitosamente',
    type: PersonResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Persona o Suscripción no encontrada.',
  })
  @ApiResponse({
    status: 400,
    description: 'La suscripción no se puede cancelar o ya está cancelada.',
  })
  cancelSubscription(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
    @Body() cancelDto: CancelSubscriptionDto,
  ) {
    return this.personsService.cancelSubscription(
      personId,
      subscriptionId,
      cancelDto,
    );
  }

  @Patch(':personId/contracts/:contractId/cancel')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({ summary: 'Cancelar un contrato de un cliente' })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona (cliente)',
  })
  @ApiParam({
    name: 'contractId',
    type: Number,
    description: 'ID del contrato a cancelar',
  })
  @ApiResponse({ status: 200, description: 'Contrato cancelado exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Persona o Contrato no encontrado.',
  })
  @ApiResponse({
    status: 400,
    description: 'El contrato no se puede cancelar o ya está cancelado.',
  })
  cancelContract(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.personsService.cancelContract(personId, contractId);
  }

  @Post(':personId/subscriptions/change-plan')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({ summary: 'Cambiar el plan de una suscripción de un cliente' })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona (cliente)',
  })
  @ApiBody({ type: ChangeSubscriptionPlanDto })
  @ApiResponse({
    status: 200,
    description: 'Plan de suscripción cambiado exitosamente.',
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description: 'Persona, Suscripción actual o Nuevo Plan no encontrado.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Solicitud incorrecta (ej. suscripción no activa, mismo plan, etc.).',
  })
  changeSubscriptionPlan(
    @Param('personId', ParseIntPipe) personId: number,
    @Body(ValidationPipe) changeSubscriptionPlanDto: ChangeSubscriptionPlanDto,
  ) {
    return this.personsService.changeSubscriptionPlan(
      personId,
      changeSubscriptionPlanDto,
    );
  }

  @Post(':personId/contracts/change-price-list')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Cambiar la lista de precios de un contrato de un cliente',
    description: `Cambia la lista de precios asignada a un contrato específico de un cliente. Esto afecta los precios que se aplicarán en futuros pedidos del contrato.

## Sistema de Precios Diferenciados - CONTRATOS

**Funcionalidad:**
- Permite cambiar la \`price_list_id\` de un contrato existente
- Los nuevos pedidos del contrato usarán la nueva lista de precios
- Los pedidos anteriores mantienen sus precios originales

**Flujo de Precios en Contratos:**
1. Contrato tiene \`price_list_id\` asignada
2. Al crear pedidos: \`contract.price_list_id → price_list_item.unit_price\`
3. Si no hay precio en lista: fallback a \`product.price\`

**Casos de Uso:**
- Renegociación de precios contractuales
- Cambio de categoría de cliente (ej: de lista general a corporativa)
- Aplicación de descuentos especiales
- Migración a nuevas estructuras de precios`,
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona (cliente)',
  })
  @ApiBody({
    type: ChangeContractPriceListDto,
    examples: {
      cambioACorporativa: {
        summary: 'Cambio a Lista Corporativa',
        description: 'Migrar contrato a lista de precios corporativa',
        value: {
          contract_id: 15,
          new_price_list_id: 3,
          reason:
            'Cliente califica para descuentos corporativos por volumen de compras',
        },
      },
      renegociacionPrecio: {
        summary: 'Renegociación de Precios',
        description: 'Aplicar nueva lista tras renegociación',
        value: {
          contract_id: 8,
          new_price_list_id: 5,
          reason: 'Renegociación de contrato anual con descuentos especiales',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de precios del contrato cambiada exitosamente.',
    schema: {
      properties: {
        message: {
          type: 'string',
          example: 'Lista de precios del contrato actualizada correctamente',
        },
        contract_id: { type: 'number', example: 15 },
        old_price_list_id: { type: 'number', example: 1 },
        new_price_list_id: { type: 'number', example: 3 },
        effective_date: { type: 'string', format: 'date-time' },
        reason: {
          type: 'string',
          example:
            'Cliente califica para descuentos corporativos por volumen de compras',
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({
    status: 404,
    description:
      'Persona, Contrato actual o Nueva Lista de Precios no encontrada.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Solicitud incorrecta (ej. contrato no activo, misma lista, etc.).',
  })
  changeContractPriceList(
    @Param('personId', ParseIntPipe) personId: number,
    @Body(ValidationPipe)
    changeContractPriceListDto: ChangeContractPriceListDto,
  ) {
    return this.personsService.changeContractPriceList(
      personId,
      changeContractPriceListDto,
    );
  }

  @Get(':id/loaned-products-detail')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary:
      'Obtener los productos en comodato/alquiler con información detallada para una persona',
    description:
      'Retorna una lista detallada de productos en comodato incluyendo fechas de adquisición, IDs de pedidos y estados',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista detallada de productos en comodato/alquiler obtenida.',
    type: [LoanedProductDetailDto],
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async getLoanedProductsDetailForPerson(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<LoanedProductDetailDto[]> {
    return this.personsService.getPublicLoanedProductsDetailByPerson(id);
  }

  // Endpoints de Comodato
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @Post(':personId/comodatos')
  @UseInterceptors(
    FileInterceptor('contract_image', fileUploadConfigs.contractImages),
    CleanupFileOnErrorInterceptor,
  )
  @ApiOperation({
    summary: 'Crear un nuevo comodato para una persona',
    description:
      'Registra un nuevo comodato de productos para el cliente especificado. Puede incluir una imagen del contrato.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona/cliente',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'integer',
          example: 1,
          description: 'ID del producto en comodato',
        },
        subscription_id: {
          type: 'integer',
          example: 1,
          description: 'ID de la suscripción asociada (opcional)',
        },
        quantity: {
          type: 'integer',
          example: 2,
          description: 'Cantidad de productos en comodato',
        },
        delivery_date: {
          type: 'string',
          format: 'date',
          example: '2025-01-15',
          description: 'Fecha de entrega del comodato',
        },
        expected_return_date: {
          type: 'string',
          format: 'date',
          example: '2025-12-15',
          description: 'Fecha esperada de devolución (opcional)',
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'RETURNED', 'DAMAGED', 'LOST'],
          example: 'ACTIVE',
          description: 'Estado del comodato',
        },
        notes: {
          type: 'string',
          example: 'Comodato de bidones para cliente nuevo',
          description: 'Notas adicionales (opcional)',
        },
        deposit_amount: {
          type: 'number',
          example: 5000.0,
          description: 'Monto del depósito en garantía (opcional)',
        },
        monthly_fee: {
          type: 'number',
          example: 500.0,
          description: 'Cuota mensual del comodato (opcional)',
        },
        article_description: {
          type: 'string',
          example: 'Dispensador de agua fría/caliente',
          description: 'Descripción del artículo (opcional)',
        },
        brand: {
          type: 'string',
          example: 'Samsung',
          description: 'Marca del artículo (opcional)',
        },
        model: {
          type: 'string',
          example: 'XYZ-123',
          description: 'Modelo del artículo (opcional)',
        },
        contract_image: {
          type: 'string',
          format: 'binary',
          description:
            'Archivo del contrato (opcional, JPG, PNG, GIF, WEBP, PDF)',
        },
      },
      required: ['product_id', 'quantity', 'delivery_date', 'status'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Comodato creado exitosamente',
    type: ComodatoResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o error de validación',
  })
  @ApiResponse({ status: 404, description: 'Persona o producto no encontrado' })
  async createComodato(
    @Param('personId', ParseIntPipe) personId: number,
    @Body(ValidationPipe) createComodatoDto: CreateComodatoDto,
    @UploadedFile() file?: any,
  ): Promise<ComodatoResponseDto> {
    // Si se subió un archivo, generar la URL
    const contract_image_path = file
      ? buildImageUrl(file.filename, 'contracts')
      : createComodatoDto.contract_image_path;

    return this.personsService.createComodato({
      ...createComodatoDto,
      person_id: personId,
      contract_image_path,
    });
  }

  @Get(':personId/comodatos')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener comodatos de una persona con filtros',
    description:
      'Lista todos los comodatos asociados a una persona con opciones de filtrado',
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona/cliente',
  })
  @ApiQuery({
    name: 'product_id',
    required: false,
    type: Number,
    description: 'Filtrar por ID de producto',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'RETURNED', 'OVERDUE', 'CANCELLED'],
    description: 'Filtrar por estado',
  })
  @ApiQuery({
    name: 'delivery_date_from',
    required: false,
    type: String,
    description: 'Fecha de entrega desde (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'delivery_date_to',
    required: false,
    type: String,
    description: 'Fecha de entrega hasta (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de comodatos obtenida',
    type: [ComodatoResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  async getComodatosByPerson(
    @Param('personId', ParseIntPipe) personId: number,
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
    return this.personsService.getComodatosByPerson(personId, filters);
  }

  @Get(':personId/comodatos/:comodatoId')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: 'Obtener un comodato específico',
    description: 'Obtiene los detalles de un comodato específico',
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona/cliente',
  })
  @ApiParam({
    name: 'comodatoId',
    type: Number,
    description: 'ID del comodato',
  })
  @ApiResponse({
    status: 200,
    description: 'Comodato obtenido',
    type: ComodatoResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Persona o comodato no encontrado' })
  async getComodatoById(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('comodatoId', ParseIntPipe) comodatoId: number,
  ): Promise<ComodatoResponseDto> {
    return this.personsService.getComodatoById(personId, comodatoId);
  }

  @Patch(':personId/comodatos/:comodatoId')
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @UseInterceptors(
    FileInterceptor('contract_image', fileUploadConfigs.contractImages),
    CleanupFileOnErrorInterceptor,
  )
  @ApiOperation({
    summary: 'Actualizar un comodato',
    description:
      'Actualiza los datos de un comodato existente. Puede incluir una nueva imagen del contrato.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona/cliente',
  })
  @ApiParam({
    name: 'comodatoId',
    type: Number,
    description: 'ID del comodato',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'integer',
          example: 1,
          description: 'ID del producto en comodato',
        },
        subscription_id: {
          type: 'integer',
          example: 1,
          description: 'ID de la suscripción asociada (opcional)',
        },
        quantity: {
          type: 'integer',
          example: 2,
          description: 'Cantidad de productos en comodato',
        },
        delivery_date: {
          type: 'string',
          format: 'date',
          example: '2025-01-15',
          description: 'Fecha de entrega del comodato',
        },
        expected_return_date: {
          type: 'string',
          format: 'date',
          example: '2025-12-15',
          description: 'Fecha esperada de devolución (opcional)',
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'INACTIVE', 'RETURNED', 'DAMAGED', 'LOST'],
          example: 'ACTIVE',
          description: 'Estado del comodato',
        },
        notes: {
          type: 'string',
          example: 'Comodato de bidones para cliente nuevo',
          description: 'Notas adicionales (opcional)',
        },
        deposit_amount: {
          type: 'number',
          example: 5000.0,
          description: 'Monto del depósito en garantía (opcional)',
        },
        monthly_fee: {
          type: 'number',
          example: 500.0,
          description: 'Cuota mensual del comodato (opcional)',
        },
        article_description: {
          type: 'string',
          example: 'Dispensador de agua fría/caliente',
          description: 'Descripción del artículo (opcional)',
        },
        brand: {
          type: 'string',
          example: 'Samsung',
          description: 'Marca del artículo (opcional)',
        },
        model: {
          type: 'string',
          example: 'XYZ-123',
          description: 'Modelo del artículo (opcional)',
        },
        contract_image: {
          type: 'string',
          format: 'binary',
          description:
            'Archivo del contrato (opcional, JPG, PNG, GIF, WEBP, PDF)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Comodato actualizado',
    type: ComodatoResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Persona o comodato no encontrado' })
  async updateComodato(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('comodatoId', ParseIntPipe) comodatoId: number,
    @Body(ValidationPipe) updateComodatoDto: UpdateComodatoDto,
    @UploadedFile() file?: any,
  ): Promise<ComodatoResponseDto> {
    // Si se subió un archivo, generar la URL
    const contract_image_path = file
      ? buildImageUrl(file.filename, 'contracts')
      : updateComodatoDto.contract_image_path;

    return this.personsService.updateComodato(personId, comodatoId, {
      ...updateComodatoDto,
      contract_image_path,
    });
  }
  @Auth(Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @Delete(':personId/comodatos/:comodatoId')
  @ApiOperation({
    summary: 'Eliminar un comodato',
    description: 'Elimina un comodato del sistema',
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona/cliente',
  })
  @ApiParam({
    name: 'comodatoId',
    type: Number,
    description: 'ID del comodato',
  })
  @ApiResponse({
    status: 200,
    description: 'Comodato eliminado',
    schema: {
      properties: { message: { type: 'string' }, deleted: { type: 'boolean' } },
    },
  })
  @ApiResponse({ status: 404, description: 'Persona o comodato no encontrado' })
  async deleteComodato(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('comodatoId', ParseIntPipe) comodatoId: number,
  ) {
    return this.personsService.deleteComodato(personId, comodatoId);
  }

  @Post(':personId/comodatos/withdraw')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @ApiOperation({
    summary: '🆕 Retirar comodato sin cancelar suscripción',
    description: `Procesa el retiro independiente de un comodato específico manteniendo la suscripción activa.

## ✅ NUEVA FUNCIONALIDAD: RETIRO INDEPENDIENTE

**Características principales:**
- **Retiro selectivo**: Retira comodatos específicos sin afectar la suscripción
- **Programación flexible**: Permite programar la fecha de retiro
- **Orden de recuperación automática**: Crea automáticamente orden de recuperación
- **Orden de retiro**: Genera orden de retiro para seguimiento logístico
- **Trazabilidad completa**: Registra motivos y notas del retiro

## 🎯 CASOS DE USO

**Ejemplos comunes:**
- Cliente solicita cambio de producto manteniendo suscripción
- Retiro temporal por mudanza o viaje
- Reemplazo de producto defectuoso
- Ajuste de cantidad de productos en comodato
- Retiro por mantenimiento o limpieza

## 📋 PROCESO AUTOMATIZADO

**Flujo del sistema:**
1. **Validación**: Verifica comodato activo y suscripción vigente
2. **Programación**: Establece fecha de retiro (por defecto 7 días)
3. **Orden de recuperación**: Crea orden para programar retiro físico
4. **Orden de retiro**: Genera orden logística sin costo
5. **Actualización**: Marca comodato como "PENDING_WITHDRAWAL"
6. **Notificación**: Registra motivo y notas del retiro

## 💡 VENTAJAS

- **Flexibilidad**: No requiere cancelar toda la suscripción
- **Continuidad**: Mantiene relación comercial activa
- **Control**: Permite gestión granular de productos
- **Trazabilidad**: Historial completo de movimientos`,
  })
  @ApiParam({
    name: 'personId',
    type: Number,
    description: 'ID de la persona/cliente propietaria del comodato',
  })
  @ApiBody({
    type: WithdrawComodatoDto,
    examples: {
      retiroBasico: {
        summary: 'Retiro básico programado',
        description: 'Retiro simple con fecha automática (7 días)',
        value: {
          comodato_id: 15,
          withdrawal_reason: 'Cliente solicita cambio de producto',
          notes: 'Coordinar horario con cliente para retiro',
          create_recovery_order: true,
        },
      },
      retiroFechaProgramada: {
        summary: 'Retiro con fecha específica',
        description: 'Retiro programado para fecha específica',
        value: {
          comodato_id: 23,
          scheduled_withdrawal_date: '2024-02-15',
          withdrawal_reason: 'Mudanza temporal del cliente',
          notes: 'Cliente estará disponible entre 9:00-12:00',
          create_recovery_order: true,
        },
      },
      retiroMantenimiento: {
        summary: 'Retiro por mantenimiento',
        description: 'Retiro temporal para mantenimiento de producto',
        value: {
          comodato_id: 8,
          scheduled_withdrawal_date: '2024-02-10',
          withdrawal_reason: 'Mantenimiento preventivo de dispensador',
          notes: 'Reemplazar con producto temporal durante mantenimiento',
          create_recovery_order: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Retiro de comodato procesado exitosamente',
    type: WithdrawComodatoResponseDto,
    examples: {
      exitoso: {
        summary: 'Retiro procesado exitosamente',
        value: {
          success: true,
          message: 'Retiro de comodato procesado exitosamente',
          comodato_id: 15,
          withdrawal_order_id: 456,
          recovery_order_id: 789,
          scheduled_withdrawal_date: '2024-02-15T10:00:00.000Z',
          comodato_status: 'PENDING_WITHDRAWAL',
          product_info: {
            product_id: 1,
            product_name: 'Bidón 20L',
            quantity: 2,
          },
          subscription_info: {
            subscription_id: 7,
            subscription_status: 'ACTIVE',
            plan_name: 'Plan Familiar',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o comodato no puede ser retirado',
  })
  @ApiResponse({ status: 404, description: 'Persona o comodato no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'Conflicto: suscripción no activa o comodato ya en proceso de retiro',
  })
  async withdrawComodato(
    @Param('personId', ParseIntPipe) personId: number,
    @Body(ValidationPipe) withdrawDto: WithdrawComodatoDto,
  ): Promise<WithdrawComodatoResponseDto> {
    return this.personsService.withdrawComodato(personId, withdrawDto);
  }

  @Post('subscriptions-with-comodato')
  @ApiOperation({
    summary: 'Crear suscripción con comodato integrado',
    description:
      'Crea una nueva suscripción de cliente junto con un comodato asociado en una sola operación',
  })
  @ApiBody({ type: CreateSubscriptionWithComodatoDto })
  @ApiResponse({
    status: 201,
    description: 'Suscripción y comodato creados exitosamente',
    schema: {
      properties: {
        subscription: {
          type: 'object',
          description: 'Datos de la suscripción creada',
        },
        comodato: { type: 'object', description: 'Datos del comodato creado' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o error de validación',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente, plan de suscripción o producto no encontrado',
  })
  async createSubscriptionWithComodato(
    @Body(ValidationPipe) createDto: CreateSubscriptionWithComodatoDto,
  ) {
    return this.personsService.createSubscriptionWithComodato(createDto);
  }

  @Post('upload-contract-image')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN, Role.BOSSADMINISTRATIVE)
  @UseInterceptors(
    FileInterceptor('contract_image', fileUploadConfigs.contractImages),
    CleanupFileOnErrorInterceptor,
  )
  @ApiOperation({
    summary: 'Subir archivo de contrato de comodato',
    description:
      'Sube un archivo de contrato (imagen o PDF) y devuelve la URL para usar en comodatos',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contract_image: {
          type: 'string',
          format: 'binary',
          description: 'Archivo del contrato (JPG, PNG, GIF, WEBP, PDF)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Archivo subido exitosamente',
    schema: {
      properties: {
        message: {
          type: 'string',
          example: 'Archivo de contrato subido exitosamente',
        },
        filename: { type: 'string', example: 'contrato-abc123.pdf' },
        url: {
          type: 'string',
          example:
            'http://localhost:3000/public/uploads/contracts/contrato-abc123.pdf',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo inválido o no proporcionado',
  })
  async uploadContractImage(@UploadedFile() file: any) {
    if (!file) {
      throw new Error('No se proporcionó ningún archivo');
    }

    const url = buildImageUrl(file.filename, 'contracts');

    return {
      message: 'Imagen de contrato subida exitosamente',
      filename: file.filename,
      url: url,
    };
  }
}
