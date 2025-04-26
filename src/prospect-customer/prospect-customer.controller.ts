import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CreateProspectCustomerDto } from './dto/create-prospect-customer.dto';
import { UpdateProspectCustomerDto } from './dto/update-prospect-customer.dto';
import { Role } from '@prisma/client';
import { ProspectCustomersService } from './prospect-customer.service';
import { Auth } from 'src/auth/decorators/auth.decorator';

@Auth(Role.USER)
@Controller('prospect-customers')
export class ProspectCustomersController {
  constructor(
    private readonly prospectCustomersService: ProspectCustomersService,
  ) { }

  @Post()
  async createProspectCustomer(
    @Body() dto: CreateProspectCustomerDto
  ) {
    return this.prospectCustomersService.createProspectCustomer(dto);
  }

  @Get()
  async getAllProspectCustomer() {
    return this.prospectCustomersService.getAllProspectCustomer();
  }

  @Get(':id')
  async getProspectCustomerById(
    @Param('id') id: string
  ) {
    return this.prospectCustomersService.getProspectCustomerById(+id);
  }

  @Patch(':id')
  async updateProspectCustomerById(
    @Param('id') id: string,
    @Body() dto: UpdateProspectCustomerDto,
  ) {
    return this.prospectCustomersService.updateProspectCustomerById(+id, dto);
  }

  @Delete(':id')
  async deleteProspectCustomerById(
    @Param('id') id: string
  ) {
    return this.prospectCustomersService.deleteProspectCustomerById(+id);
  }
}
