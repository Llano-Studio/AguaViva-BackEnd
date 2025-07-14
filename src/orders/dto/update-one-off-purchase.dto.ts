import { PartialType } from '@nestjs/swagger';
import { CreateOneOffPurchaseDto } from './create-one-off-purchase.dto';
import { IsOptional, IsDateString } from 'class-validator';

export class UpdateOneOffPurchaseDto extends PartialType(CreateOneOffPurchaseDto) {
    // Hereda todas las propiedades de CreateOneOffPurchaseDto como opcionales.
    // Incluye: person_id, items[], sale_channel_id, price_list_id, locality_id, zone_id, delivery_address
    // ya que PartialType los hace opcionales.

    // purchase_date también es actualizable y opcional:
    @IsOptional()
    @IsDateString()
    purchase_date?: string;
} 