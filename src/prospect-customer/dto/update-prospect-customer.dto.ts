import { PartialType } from '@nestjs/mapped-types';
import { CreateProspectCustomerDto } from './create-prospect-customer.dto';

export class UpdateProspectCustomerDto extends PartialType(CreateProspectCustomerDto) { }
