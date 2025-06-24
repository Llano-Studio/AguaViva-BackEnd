import { PartialType } from '@nestjs/swagger';
import { CreateOneOffPurchaseDto } from './create-one-off-purchase.dto';
import { IsOptional, IsDateString } from 'class-validator';

export class UpdateOneOffPurchaseDto extends PartialType(CreateOneOffPurchaseDto) {
    // Hereda todas las propiedades de CreateOneOffPurchaseDto como opcionales.
    // No es necesario redefinir product_id, person_id, quantity, sale_channel_id, locality_id, zone_id
    // ya que PartialType los hace opcionales.

    // Si queremos que purchase_date también sea actualizable y opcional:
    @IsOptional()
    @IsDateString()
    purchase_date?: string; // Añadido
} 