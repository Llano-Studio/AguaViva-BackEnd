import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth,
} from '@nestjs/swagger';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { Role } from '@prisma/client';

@ApiTags('persons')
@ApiBearerAuth()
@Auth(Role.ADMIN, Role.USER)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) { }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva persona' })
  @ApiResponse({ status: 201, description: 'Persona creada', type: CreatePersonDto })
  createPerson(@Body() dto: CreatePersonDto) {
    return this.personsService.createPerson(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar personas, filtrar por nombre o dirección' })
  @ApiQuery({ name: 'name', required: false, description: 'Filtrar por nombre' })
  @ApiQuery({ name: 'address', required: false, description: 'Filtrar por dirección' })
  @ApiResponse({ status: 200, description: 'Listado de personas', type: [CreatePersonDto] })
  findAllPersons(
    @Query('name') name?: string,
    @Query('address') address?: string,
  ) {
    if (name) return this.personsService.findPersonByName(name);
    if (address) return this.personsService.findPersonByAddress(address);
    return this.personsService.findAllPersons();
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: Number, description: 'ID de la persona' })
  @ApiOperation({ summary: 'Obtener una persona por ID' })
  @ApiResponse({ status: 200, description: 'Datos de la persona', type: CreatePersonDto })
  findPersonById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.personsService.findPersonById(id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id', type: Number })
  @ApiOperation({ summary: 'Actualizar datos de una persona' })
  @ApiResponse({ status: 200, description: 'Persona actualizada', type: CreatePersonDto })
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
