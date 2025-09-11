import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsDateString, Min } from 'class-validator';

export class ChangeContractPriceListDto {
  @ApiProperty({
    description: 'ID del contrato actual que se va a cambiar.',
    example: 1,
  })
  @IsInt()
  @Min(1)
  current_contract_id: number;

  @ApiProperty({
    description:
      'ID de la nueva lista de precios (price_list_id) para el contrato.',
    example: 2,
  })
  @IsInt()
  @Min(1)
  new_price_list_id: number;

  @ApiProperty({
    description:
      'Fecha opcional a partir de la cual el nuevo contrato debe entrar en vigor. (Actualmente no implementado en la lógica de servicio, se calcula basado en el fin del contrato anterior).',
    example: '2024-08-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  effective_date?: string;
}
