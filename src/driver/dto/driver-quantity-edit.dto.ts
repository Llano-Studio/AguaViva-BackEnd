import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Administración habilita al chofer a reducir cantidades de una parada. */
export class EnableQuantityEditDto {
  @ApiProperty({
    example: 'El cliente avisó que solo puede recibir 3 bidones',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  reason: string;
}

export class QuantityEditChangeDto {
  @ApiProperty({ example: 1 })
  product_id: number;

  @ApiProperty({ example: 5 })
  from_quantity: number;

  @ApiProperty({ example: 3 })
  to_quantity: number;
}

export class QuantityEditAuthorizationDto {
  @ApiProperty({ example: 9 })
  edit_id: number;

  @ApiProperty({ example: 1002 })
  route_sheet_detail_id: number;

  @ApiProperty()
  reason: string;

  @ApiProperty({ example: 3 })
  enabled_by: number;

  @ApiProperty({ example: '2026-11-16T10:15:00-03:00' })
  enabled_at: string;

  @ApiPropertyOptional({ nullable: true })
  used_at: string | null;

  @ApiPropertyOptional({ nullable: true })
  revoked_at: string | null;

  @ApiPropertyOptional({ type: [QuantityEditChangeDto], nullable: true })
  changes: QuantityEditChangeDto[] | null;
}

export class DeliveryItemQuantityDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  product_id: number;

  @ApiProperty({ description: 'Nueva cantidad a entregar', example: 3 })
  @IsInt()
  @Min(0)
  quantity: number;
}

/** El chofer reduce cantidades de la parada (requiere habilitación). */
export class UpdateDeliveryItemsDto {
  @ApiProperty({ type: [DeliveryItemQuantityDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => DeliveryItemQuantityDto)
  items: DeliveryItemQuantityDto[];
}
