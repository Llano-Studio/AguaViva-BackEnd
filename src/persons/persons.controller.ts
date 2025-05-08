import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe, ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth,
} from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonResponseDto } from './dto/person-response.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';
import { PersonType } from '../constants/enums';

@ApiTags('persons')
@ApiBearerAuth()
@Auth(Role.ADMIN, Role.USER)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva persona' })
  @ApiResponse({ status: 201, description: 'Persona creada', type: PersonResponseDto })
  createPerson(@Body() dto: CreatePersonDto) {
    return this.personsService.createPerson(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar personas, filtrar por nombre, dirección o tipo' })
  @ApiQuery({ name: 'name', required: false, description: 'Filtrar por nombre' })
  @ApiQuery({ name: 'address', required: false, description: 'Filtrar por dirección' })
  @ApiQuery({ 
    name: 'type', 
    required: false, 
    enum: PersonType,
    description: 'Filtrar por tipo de persona' 
  })
  @ApiResponse({ status: 200, description: 'Listado de personas', type: [PersonResponseDto] })
  findAllPersons(
    @Query('name') name?: string,
    @Query('address') address?: string,
    @Query('type') type?: PersonType,
  ) {
    if (name) return this.personsService.findPersonByName(name);
    if (address) return this.personsService.findPersonByAddress(address);
    if (type) return this.personsService.findPersonByType(type);
    return this.personsService.findAllPersons();
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: Number, description: 'ID de la persona' })
  @ApiOperation({ summary: 'Obtener una persona por ID' })
  @ApiResponse({ status: 200, description: 'Datos de la persona', type: PersonResponseDto })
  findPersonById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.personsService.findPersonById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Actualizar datos de una persona' })
  @ApiResponse({ status: 200, description: 'Persona actualizada', type: PersonResponseDto })
  updatePerson(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonDto,
  ) {
    return this.personsService.updatePerson(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Eliminar una persona' })
  @ApiResponse({ status: 200, description: 'Persona eliminada' })
  deletePerson(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.personsService.deletePerson(id);
  }
}
