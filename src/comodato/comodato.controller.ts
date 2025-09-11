import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PersonsService } from '../persons/persons.service';
import { ComodatoResponseDto } from '../persons/dto/comodato-response.dto';
import { FilterComodatosDto } from '../persons/dto/filter-comodatos.dto';

@ApiTags('Comodatos')
@Controller('comodatos')
export class ComodatoController {
  constructor(private readonly personsService: PersonsService) {}

  @Get('get-all-comodatos')
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
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Búsqueda general' })
  @ApiResponse({ status: 200, description: 'Lista de comodatos obtenida', type: [ComodatoResponseDto] })
  async getAllComodatos(
    @Query(new ValidationPipe({ transform: true, transformOptions: { enableImplicitConversion: true }, whitelist: true, skipMissingProperties: true })) filters: FilterComodatosDto,
  ): Promise<ComodatoResponseDto[]> {
    return this.personsService.getAllComodatos(filters);
  }
}