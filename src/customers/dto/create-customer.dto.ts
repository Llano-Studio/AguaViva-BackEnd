import {
    IsString,
    IsOptional,
    IsInt,
    IsDateString,
    IsDecimal,
    IsNotEmpty,
  } from 'class-validator';
  
  export class CreateCustomerDto {

    @IsString() 
    @IsNotEmpty()
    name: string;
  
    @IsString() 
    @IsNotEmpty()
    taxId: string;
  
    @IsString() 
    @IsNotEmpty()
    vatCategory: string;
  
    @IsString() 
    @IsOptional()
    phone?: string;
  
    @IsString() 
    @IsOptional()
    mobile?: string;
  
    @IsString() 
    @IsNotEmpty()
    address: string;
  
    @IsInt()
    localityId: number;
  
    @IsInt()
    zoneId: number;
  
    @IsDateString()
    registrationDate: string;
  
    @IsString() 
    @IsNotEmpty()
    status: string;
  
    @IsDecimal() 
    @IsOptional()
    debt?: number;
  
    @IsString() 
    @IsOptional()
    notes?: string;
  
    @IsInt() 
    @IsOptional()
    subscriptionPlanId?: number;
  }
  