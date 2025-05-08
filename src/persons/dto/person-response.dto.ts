import { ApiProperty } from '@nestjs/swagger';
import { CreatePersonDto } from './create-person.dto';

export class PersonResponseDto extends CreatePersonDto {
  @ApiProperty({ example: 1 })
  person_id: number;

  @ApiProperty({ example: '2023-06-15' })
  registration_date: Date;

  @ApiProperty({ example: { name: 'Rosario', province: { name: 'Santa Fe' } } })
  locality: any;

  @ApiProperty({ example: { name: 'Centro' } })
  zone: any;
} 