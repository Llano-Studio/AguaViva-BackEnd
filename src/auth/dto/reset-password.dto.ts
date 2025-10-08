import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: '<jwt-token>' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewPass123' })
  @IsString()
  @MinLength(6)
  password: string;
}
