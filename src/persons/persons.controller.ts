import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PersonsService } from './persons.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { Role } from '@prisma/client';
import { Auth } from 'src/auth/decorators/auth.decorator';

@Auth(Role.ADMIN, Role.USER)
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) { }

  @Post()
  createPerson(
    @Body() dto: CreatePersonDto
  ) {
    return this.personsService.createPerson(dto);
  }

  @Get()
  findAllPersons() {
    return this.personsService.findAllPersons();
  }

  @Get('by-id/:id')
  findPersonById(
    @Param('id') id: string
  ) {
    return this.personsService.findPersonById(+id);
  }

  @Get('by-name/:name')
  findPersonByName(
    @Param('name') name: string
  ) {
    return this.personsService.findPersonByName(name);
  }

  @Get('by-address/:address')
  findPersonByAddress(
    @Param('address') address: string
  ) {
    return this.personsService.findPersonByAddress(address);
  }

  @Patch(':id')
  updatePerson(
    @Param('id') id: string,
    @Body() dto: UpdatePersonDto
  ) {
    return this.personsService.updatePerson(+id, dto);
  }

  @Delete(':id')
  deletePerson(
    @Param('id') id: string
  ) {
    return this.personsService.deletePerson(+id);
  }
}
