import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @IsString()
  @MinLength(6, {
    message: 'La nueva contraseña debe tener al menos 6 caracteres',
  })
  @MaxLength(50, {
    message: 'La nueva contraseña no puede tener más de 50 caracteres',
  })
  @Matches(/(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'La nueva contraseña debe contener al menos: una letra mayúscula, una letra minúscula y un número',
  })
  newPassword: string;
}
