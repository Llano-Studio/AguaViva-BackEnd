import {
    IsString,
    IsOptional,
    IsInt,
    IsDateString,
    IsNotEmpty,
} from 'class-validator';

export class CreateProspectCustomerDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    taxId?: string;

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
    @IsOptional()
    notes?: string;
}
