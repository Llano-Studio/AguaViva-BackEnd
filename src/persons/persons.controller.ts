import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, ValidationPipe, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiProperty, ApiBody, ApiConsumes,
} from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonResponseDto } from './dto/person-response.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { PersonType } from '../common/constants/enums';
import { ChangeSubscriptionPlanDto } from './dto/change-subscription-plan.dto';
import { ChangeContractPriceListDto } from './dto/change-contract-price-list.dto';
import { FilterPersonsDto } from './dto/filter-persons.dto';
import { LoanedProductDetailDto } from './dto/person-response.dto';
import {
  CreateComodatoDto,
  UpdateComodatoDto,
  FilterComodatosDto,
  ComodatoResponseDto,
  CreateSubscriptionWithComodatoDto,
} from './dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileUploadConfigs, buildImageUrl } from '../common/utils/file-upload.util';
import { Express } from 'express';

class PaginatedPersonsResponseDto {
  @ApiProperty({ type: [PersonResponseDto] })
  data: PersonResponseDto[];

  @ApiProperty({
    type: 'object',
    properties: {
      total: { type: 'number', example: 100, description: 'Total de personas disponibles' },
      page: { type: 'number', example: 1, description: 'Número de la página actual' },
      limit: { type: 'number', example: 10, description: 'Número de personas por página' },
      totalPages: { type: 'number', example: 10, description: 'Total de páginas disponibles' }
    }
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@ApiTags('Clientes')
@ApiBearerAuth()
@Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva persona' })
  @ApiResponse({ status: 201, description: 'Persona creada', type: PersonResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error de validación' })
  @ApiResponse({ status: 409, description: 'Conflicto, ej: CUIT/Email ya existe' })
  createPerson(
    @Body(ValidationPipe) dto: CreatePersonDto
  ): Promise<PersonResponseDto> {
    return this.personsService.createPerson(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar personas con filtros y paginación' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda general por nombre, dirección, teléfono o CUIT/CUIL/DNI' })
  @ApiQuery({ name: 'personId', required: false, type: Number, description: 'Filtrar por ID de persona' })
  @ApiQuery({ name: 'name', required: false, type: String, description: 'Filtrar por nombre (parcial)' })
  @ApiQuery({ name: 'address', required: false, type: String, description: 'Filtrar por dirección (parcial)' })
  @ApiQuery({ name: 'type', required: false, enum: PersonType, description: 'Filtrar por tipo de persona (para compatibilidad)' })
  @ApiQuery({ name: 'types', required: false, type: String, description: 'Filtrar por tipos de persona múltiples. Formato: "INDIVIDUAL,PLAN" o array' })
  @ApiQuery({ name: 'phone', required: false, type: String, description: 'Filtrar por teléfono (parcial)' })
  @ApiQuery({ name: 'taxId', required: false, type: String, description: 'Filtrar por CUIT/CUIL/DNI (parcial)' })
  @ApiQuery({ name: 'localityId', required: false, type: Number, description: 'Filtrar por ID de localidad (para compatibilidad)' })
  @ApiQuery({ name: 'localityIds', required: false, type: String, description: 'Filtrar por IDs de localidades múltiples. Formato: "1,2,3" o array [1,2,3]' })
  @ApiQuery({ name: 'zoneId', required: false, type: Number, description: 'Filtrar por ID de zona (para compatibilidad)' })
  @ApiQuery({ name: 'zoneIds', required: false, type: String, description: 'Filtrar por IDs de zonas múltiples. Formato: "1,2,3" o array [1,2,3]' })
  @ApiQuery({ 
    name: 'payment_semaphore_status', 
    required: false, 
    type: String, 
    description: 'Filtrar por estado del semáforo de pagos (NONE, GREEN, YELLOW, RED) - para compatibilidad', 
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED'] 
  })
  @ApiQuery({ 
    name: 'payment_semaphore_statuses', 
    required: false, 
    type: String, 
    description: 'Filtrar por estados del semáforo múltiples. Formato: "GREEN,YELLOW" o array', 
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED'] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Campos para ordenar. Prefijo \'-\' para descendente. Incluye payment_semaphore_status. Ej: name,-payment_semaphore_status,registrationDate', example: 'name,-payment_semaphore_status' })
  @ApiResponse({ status: 200, description: 'Listado paginado de personas', type: PaginatedPersonsResponseDto })
  findAllPersons(
    @Query(
      new ValidationPipe(
        { 
          transform: true, 
          whitelist: true, 
          forbidNonWhitelisted: true 
        }
      )) filters: FilterPersonsDto,
  ): Promise<PaginatedPersonsResponseDto> {
    return this.personsService.findAllPersons(filters);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: Number, description: 'ID de la persona' })
  @ApiOperation({ summary: 'Obtener una persona por ID' })
  @ApiResponse({ status: 200, description: 'Datos de la persona', type: PersonResponseDto })
  findPersonById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PersonResponseDto> {
    return this.personsService.findPersonById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Actualizar datos de una persona' })
  @ApiResponse({ status: 200, description: 'Persona actualizada', type: PersonResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error de validación' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  @ApiResponse({ status: 409, description: 'Conflicto, ej: CUIT/Email ya existe en otra persona' })
  updatePerson(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) dto: UpdatePersonDto,
  ): Promise<PersonResponseDto> {
    return this.personsService.updatePerson(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Eliminar una persona' })
  @ApiResponse({ status: 200, description: 'Persona eliminada', schema: { properties: { message: { type: 'string'}, deleted: {type: 'boolean'} } } })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  @ApiResponse({ status: 409, description: 'Conflicto, la persona tiene datos asociados (pedidos, contratos, etc.)' })
  deletePerson(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.personsService.deletePerson(id);
  }

  @Patch(':personId/subscriptions/:subscriptionId/cancel')
  @ApiOperation({ summary: 'Cancelar una suscripción de un cliente' })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona (cliente)' })
  @ApiParam({ name: 'subscriptionId', type: Number, description: 'ID de la suscripción a cancelar' })
  @ApiResponse({ status: 200, description: 'Suscripción cancelada exitosamente', type: PersonResponseDto })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Persona o Suscripción no encontrada.' })
  @ApiResponse({ status: 400, description: 'La suscripción no se puede cancelar o ya está cancelada.' })
  cancelSubscription(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
  ) {
    return this.personsService.cancelSubscription(personId, subscriptionId);
  }

  @Patch(':personId/contracts/:contractId/cancel')
  @ApiOperation({ summary: 'Cancelar un contrato de un cliente' })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona (cliente)' })
  @ApiParam({ name: 'contractId', type: Number, description: 'ID del contrato a cancelar' })
  @ApiResponse({ status: 200, description: 'Contrato cancelado exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Persona o Contrato no encontrado.' })
  @ApiResponse({ status: 400, description: 'El contrato no se puede cancelar o ya está cancelado.' })
  cancelContract(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('contractId', ParseIntPipe) contractId: number,
  ) {
    return this.personsService.cancelContract(personId, contractId);
  }

  @Post(':personId/subscriptions/change-plan')
  @ApiOperation({ summary: 'Cambiar el plan de una suscripción de un cliente' })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona (cliente)' })
  @ApiBody({ type: ChangeSubscriptionPlanDto })
  @ApiResponse({ status: 200, description: 'Plan de suscripción cambiado exitosamente.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Persona, Suscripción actual o Nuevo Plan no encontrado.' })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta (ej. suscripción no activa, mismo plan, etc.).' })
  changeSubscriptionPlan(
    @Param('personId', ParseIntPipe) personId: number,
    @Body(ValidationPipe) changeSubscriptionPlanDto: ChangeSubscriptionPlanDto,
  ) {
    return this.personsService.changeSubscriptionPlan(personId, changeSubscriptionPlanDto);
  }

  @Post(':personId/contracts/change-price-list')
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
- Migración a nuevas estructuras de precios`
  })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona (cliente)' })
  @ApiBody({ 
    type: ChangeContractPriceListDto,
    examples: {
      cambioACorporativa: {
        summary: 'Cambio a Lista Corporativa',
        description: 'Migrar contrato a lista de precios corporativa',
        value: {
          contract_id: 15,
          new_price_list_id: 3,
          reason: 'Cliente califica para descuentos corporativos por volumen de compras'
        }
      },
      renegociacionPrecio: {
        summary: 'Renegociación de Precios',
        description: 'Aplicar nueva lista tras renegociación',
        value: {
          contract_id: 8,
          new_price_list_id: 5,
          reason: 'Renegociación de contrato anual con descuentos especiales'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de precios del contrato cambiada exitosamente.',
    schema: {
      properties: {
        message: { type: 'string', example: 'Lista de precios del contrato actualizada correctamente' },
        contract_id: { type: 'number', example: 15 },
        old_price_list_id: { type: 'number', example: 1 },
        new_price_list_id: { type: 'number', example: 3 },
        effective_date: { type: 'string', format: 'date-time' },
        reason: { type: 'string', example: 'Cliente califica para descuentos corporativos por volumen de compras' }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Persona, Contrato actual o Nueva Lista de Precios no encontrada.' })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta (ej. contrato no activo, misma lista, etc.).' })
  changeContractPriceList(
    @Param('personId', ParseIntPipe) personId: number,
    @Body(ValidationPipe) changeContractPriceListDto: ChangeContractPriceListDto,
  ) {
    return this.personsService.changeContractPriceList(personId, changeContractPriceListDto);
  }

  @Get(':id/loaned-products-detail')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Obtener los productos en comodato/alquiler con información detallada para una persona',
    description: 'Retorna una lista detallada de productos en comodato incluyendo fechas de adquisición, IDs de pedidos y estados'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista detallada de productos en comodato/alquiler obtenida.', 
    type: [LoanedProductDetailDto] 
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async getLoanedProductsDetailForPerson(
    @Param('id', ParseIntPipe) id: number
  ): Promise<LoanedProductDetailDto[]> {
    return this.personsService.getPublicLoanedProductsDetailByPerson(id);
  }

  // Endpoints de Comodato
  @Post(':personId/comodatos')
  @ApiOperation({ 
    summary: 'Crear un nuevo comodato para una persona',
    description: 'Registra un nuevo comodato de productos para el cliente especificado'
  })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona/cliente' })
  @ApiResponse({ status: 201, description: 'Comodato creado exitosamente', type: ComodatoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error de validación' })
  @ApiResponse({ status: 404, description: 'Persona o producto no encontrado' })
  async createComodato(
    @Param('personId', ParseIntPipe) personId: number,
    @Body(ValidationPipe) createComodatoDto: CreateComodatoDto
  ): Promise<ComodatoResponseDto> {
    return this.personsService.createComodato({ ...createComodatoDto, person_id: personId });
  }

  @Get(':personId/comodatos')
  @ApiOperation({ 
    summary: 'Obtener comodatos de una persona con filtros',
    description: 'Lista todos los comodatos asociados a una persona con opciones de filtrado'
  })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona/cliente' })
  @ApiQuery({ name: 'product_id', required: false, type: Number, description: 'Filtrar por ID de producto' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'RETURNED', 'OVERDUE', 'CANCELLED'], description: 'Filtrar por estado' })
  @ApiQuery({ name: 'delivery_date_from', required: false, type: String, description: 'Fecha de entrega desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'delivery_date_to', required: false, type: String, description: 'Fecha de entrega hasta (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Lista de comodatos obtenida', type: [ComodatoResponseDto] })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  async getComodatosByPerson(
    @Param('personId', ParseIntPipe) personId: number,
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, skipMissingProperties: true })) filters: FilterComodatosDto
  ): Promise<ComodatoResponseDto[]> {
    return this.personsService.getComodatosByPerson(personId, filters);
  }

  @Get('comodatos')
  @Auth(Role.ADMINISTRATIVE, Role.SUPERADMIN)
  @ApiOperation({ 
    summary: 'Obtener todos los comodatos con filtros',
    description: 'Lista todos los comodatos del sistema con opciones de filtrado avanzado'
  })
  @ApiQuery({ name: 'person_id', required: false, type: Number, description: 'Filtrar por ID de persona' })
  @ApiQuery({ name: 'product_id', required: false, type: Number, description: 'Filtrar por ID de producto' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'RETURNED', 'OVERDUE', 'CANCELLED'], description: 'Filtrar por estado' })
  @ApiQuery({ name: 'zone_id', required: false, type: Number, description: 'Filtrar por zona' })
  @ApiQuery({ name: 'customer_name', required: false, type: String, description: 'Buscar por nombre de cliente' })
  @ApiQuery({ name: 'product_name', required: false, type: String, description: 'Buscar por nombre de producto' })
  @ApiQuery({ name: 'delivery_date_from', required: false, type: String, description: 'Fecha de entrega desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'delivery_date_to', required: false, type: String, description: 'Fecha de entrega hasta (YYYY-MM-DD)' })
  @ApiQuery({ name: 'expected_return_date_from', required: false, type: String, description: 'Fecha de devolución esperada desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'expected_return_date_to', required: false, type: String, description: 'Fecha de devolución esperada hasta (YYYY-MM-DD)' })
  @ApiQuery({ name: 'actual_return_date_from', required: false, type: String, description: 'Fecha de devolución real desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'actual_return_date_to', required: false, type: String, description: 'Fecha de devolución real hasta (YYYY-MM-DD)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda general' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Límite de resultados por página' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Campos para ordenar' })
  @ApiResponse({ status: 200, description: 'Lista de comodatos obtenida exitosamente', type: [ComodatoResponseDto] })
  async getAllComodatos(
    @Query() filters: any,
  ): Promise<ComodatoResponseDto[]> {
    // Manual parameter processing to avoid ValidationPipe issues
    const processedFilters: FilterComodatosDto = {
      page: filters.page ? parseInt(filters.page) : undefined,
      limit: filters.limit ? parseInt(filters.limit) : undefined,
      sortBy: filters.sortBy || undefined,
      person_id: filters.person_id ? parseInt(filters.person_id) : undefined,
      product_id: filters.product_id ? parseInt(filters.product_id) : undefined,
      status: filters.status || undefined,
      zone_id: filters.zone_id ? parseInt(filters.zone_id) : undefined,
      customer_name: filters.customer_name || undefined,
      product_name: filters.product_name || undefined,
      delivery_date_from: filters.delivery_date_from || undefined,
      delivery_date_to: filters.delivery_date_to || undefined,
      expected_return_date_from: filters.expected_return_date_from || undefined,
      expected_return_date_to: filters.expected_return_date_to || undefined,
      actual_return_date_from: filters.actual_return_date_from || undefined,
      actual_return_date_to: filters.actual_return_date_to || undefined,
      search: filters.search || undefined,
    };
    return this.personsService.getAllComodatos(processedFilters);
  }

  @Get('all-comodatos')
  @ApiOperation({ 
    summary: 'Obtener todos los comodatos con filtros (público para testing)',
    description: 'Lista todos los comodatos del sistema con opciones de filtrado avanzado - endpoint público para pruebas'
  })
  @ApiQuery({ name: 'person_id', required: false, type: Number, description: 'Filtrar por ID de persona' })
  @ApiQuery({ name: 'product_id', required: false, type: Number, description: 'Filtrar por ID de producto' })
  @ApiQuery({ name: 'status', required: false, enum: ['ACTIVE', 'RETURNED', 'OVERDUE', 'CANCELLED'], description: 'Filtrar por estado' })
  @ApiQuery({ name: 'zone_id', required: false, type: Number, description: 'Filtrar por zona' })
  @ApiQuery({ name: 'customer_name', required: false, type: String, description: 'Buscar por nombre de cliente' })
  @ApiQuery({ name: 'product_name', required: false, type: String, description: 'Buscar por nombre de producto' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda general' })
  @ApiResponse({ status: 200, description: 'Lista de comodatos obtenida', type: [ComodatoResponseDto] })
  async getAllComodatosPublic(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, skipMissingProperties: true })) filters: FilterComodatosDto,
  ): Promise<ComodatoResponseDto[]> {
    return this.personsService.getAllComodatos(filters);
  }

  @Get(':personId/comodatos/:comodatoId')
  @ApiOperation({ 
    summary: 'Obtener un comodato específico',
    description: 'Obtiene los detalles de un comodato específico'
  })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona/cliente' })
  @ApiParam({ name: 'comodatoId', type: Number, description: 'ID del comodato' })
  @ApiResponse({ status: 200, description: 'Comodato obtenido', type: ComodatoResponseDto })
  @ApiResponse({ status: 404, description: 'Persona o comodato no encontrado' })
  async getComodatoById(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('comodatoId', ParseIntPipe) comodatoId: number
  ): Promise<ComodatoResponseDto> {
    return this.personsService.getComodatoById(personId, comodatoId);
  }

  @Patch(':personId/comodatos/:comodatoId')
  @ApiOperation({ 
    summary: 'Actualizar un comodato',
    description: 'Actualiza los datos de un comodato existente'
  })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona/cliente' })
  @ApiParam({ name: 'comodatoId', type: Number, description: 'ID del comodato' })
  @ApiResponse({ status: 200, description: 'Comodato actualizado', type: ComodatoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Persona o comodato no encontrado' })
  async updateComodato(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('comodatoId', ParseIntPipe) comodatoId: number,
    @Body(ValidationPipe) updateComodatoDto: UpdateComodatoDto
  ): Promise<ComodatoResponseDto> {
    return this.personsService.updateComodato(personId, comodatoId, updateComodatoDto);
  }

  @Delete(':personId/comodatos/:comodatoId')
  @ApiOperation({ 
    summary: 'Eliminar un comodato',
    description: 'Elimina un comodato del sistema'
  })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona/cliente' })
  @ApiParam({ name: 'comodatoId', type: Number, description: 'ID del comodato' })
  @ApiResponse({ status: 200, description: 'Comodato eliminado', schema: { properties: { message: { type: 'string' }, deleted: { type: 'boolean' } } } })
  @ApiResponse({ status: 404, description: 'Persona o comodato no encontrado' })
  async deleteComodato(
    @Param('personId', ParseIntPipe) personId: number,
    @Param('comodatoId', ParseIntPipe) comodatoId: number
  ) {
    return this.personsService.deleteComodato(personId, comodatoId);
  }

  @Post('subscriptions-with-comodato')
  @ApiOperation({ 
    summary: 'Crear suscripción con comodato integrado',
    description: 'Crea una nueva suscripción de cliente junto con un comodato asociado en una sola operación'
  })
  @ApiBody({ type: CreateSubscriptionWithComodatoDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Suscripción y comodato creados exitosamente',
    schema: {
      properties: {
        subscription: { type: 'object', description: 'Datos de la suscripción creada' },
        comodato: { type: 'object', description: 'Datos del comodato creado' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos o error de validación' })
  @ApiResponse({ status: 404, description: 'Cliente, plan de suscripción o producto no encontrado' })
  async createSubscriptionWithComodato(
    @Body(ValidationPipe) createDto: CreateSubscriptionWithComodatoDto
  ) {
    return this.personsService.createSubscriptionWithComodato(createDto);
  }

  @Post('upload-contract-image')
  @UseInterceptors(FileInterceptor('contract_image', fileUploadConfigs.contractImages))
  @ApiOperation({ 
    summary: 'Subir imagen de contrato de comodato',
    description: 'Sube una imagen de contrato y devuelve la URL para usar en comodatos'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contract_image: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de imagen del contrato (JPG, PNG, etc.)'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Imagen subida exitosamente',
    schema: {
      properties: {
        message: { type: 'string', example: 'Imagen de contrato subida exitosamente' },
        filename: { type: 'string', example: 'contrato-abc123.jpg' },
        url: { type: 'string', example: 'http://localhost:3000/public/uploads/contracts/contrato-abc123.jpg' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Archivo inválido o no proporcionado' })
  async uploadContractImage(
    @UploadedFile() file: any
  ) {
    if (!file) {
      throw new Error('No se proporcionó ningún archivo');
    }
    
    const url = buildImageUrl(file.filename, 'contracts');
    
    return {
      message: 'Imagen de contrato subida exitosamente',
      filename: file.filename,
      url: url
    };
  }
}
