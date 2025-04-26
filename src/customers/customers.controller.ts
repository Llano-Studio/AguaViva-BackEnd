import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Role } from '@prisma/client';
import { Auth } from 'src/auth/decorators/auth.decorator';

@Auth(Role.USER)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) { }

  @Post()
  async createCustomber(
    @Body() createCustomerDto: CreateCustomerDto
  ) {
    return this.customersService.createCustomber(createCustomerDto);
  }

  @Get()
  async findAllCustomers() {
    return this.customersService.findAllCustomers();
  }

  @Get(':id')
  async getCustomerById(@Param('id') id: string) {
    return this.customersService.getCustomerById(+id);
  }

  @Patch(':id')
  async updateCustomerById(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto
  ) {
    return this.customersService.updateCustomerById(+id, updateCustomerDto);
  }

  @Delete(':id')
  deleteCustomer(
    @Param('id') id: string
  ) {
    return this.customersService.deleteCustomer(+id);
  }
}
