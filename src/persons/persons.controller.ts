import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiProperty, ApiBody,
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
import { LoanedProductDto } from './dto';

class PaginatedPersonsResponseDto {
  @ApiProperty({ type: [PersonResponseDto] })
  data: PersonResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 10 })
  totalPages: number; 
}

@ApiTags('Clientes')
@ApiBearerAuth()
@Auth(Role.ADMIN, Role.USER)
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
  @ApiQuery({ name: 'type', required: false, enum: PersonType, description: 'Filtrar por tipo de persona' })
  @ApiQuery({ name: 'phone', required: false, type: String, description: 'Filtrar por teléfono (parcial)' })
  @ApiQuery({ name: 'taxId', required: false, type: String, description: 'Filtrar por CUIT/CUIL/DNI (parcial)' })
  @ApiQuery({ name: 'localityId', required: false, type: Number, description: 'Filtrar por ID de localidad' })
  @ApiQuery({ name: 'zoneId', required: false, type: Number, description: 'Filtrar por ID de zona' })
  @ApiQuery({ 
    name: 'payment_semaphore_status', 
    required: false, 
    type: String, 
    description: 'Filtrar por estado del semáforo de pagos (NONE, GREEN, YELLOW, RED)', 
    enum: ['NONE', 'GREEN', 'YELLOW', 'RED'] 
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Número de página', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Resultados por página', example: 10 })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Campos para ordenar. Prefijo \'-\' para descendente. Ej: name,-registrationDate', example: 'name,-registrationDate' })
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
  @ApiOperation({ summary: 'Cambiar la lista de precios de un contrato de un cliente' })
  @ApiParam({ name: 'personId', type: Number, description: 'ID de la persona (cliente)' })
  @ApiBody({ type: ChangeContractPriceListDto })
  @ApiResponse({ status: 200, description: 'Lista de precios del contrato cambiada exitosamente.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado.' })
  @ApiResponse({ status: 404, description: 'Persona, Contrato actual o Nueva Lista de Precios no encontrada.' })
  @ApiResponse({ status: 400, description: 'Solicitud incorrecta (ej. contrato no activo, misma lista, etc.).' })
  changeContractPriceList(
    @Param('personId', ParseIntPipe) personId: number,
    @Body(ValidationPipe) changeContractPriceListDto: ChangeContractPriceListDto,
  ) {
    return this.personsService.changeContractPriceList(personId, changeContractPriceListDto);
  }

  @Get(':id/loaned-products')
  @Auth(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: 'Obtener los productos en comodato/alquiler para una persona' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de productos en comodato/alquiler obtenida.', 
    type: [LoanedProductDto] 
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  async getLoanedProductsForPerson(
    @Param('id', ParseIntPipe) id: number
  ): Promise<LoanedProductDto[]> {
    return this.personsService.getPublicLoanedProductsByPerson(id);
  }
}
