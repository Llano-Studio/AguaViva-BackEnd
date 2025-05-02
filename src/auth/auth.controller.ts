import { Controller, Post, Body, Get, Put, Delete, Param, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { GetUser } from './decorators/get-user.decorator';
import { Role } from '@prisma/client';
import { Auth } from './decorators/auth.decorator';
import { User } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService) { }

  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado' })
  register(
    @Body() dto: RegisterUserDto
  ) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Token de acceso' })
  login(
    @Body() dto: LoginUserDto
  ) {
    return this.authService.login(dto);
  }

  @Get('profile')
  @Auth(Role.ADMIN, Role.USER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario logueado' })
  getProfile(
    @GetUser() user: User
  ) {
    return user;
  }

  @Get('users')
  @Auth(Role.ADMIN)
  getAllUsers() {
    return this.authService.getAllUsers();
  }

  @Get('users/:id')
  @Auth(Role.ADMIN)
  getUserById(
    @Param('id') id: string
  ) {
    return this.authService.getUserById(+id);
  }

  @Put('users/:id')
  @Auth(Role.ADMIN)
  updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.authService.updateUser(+id, updateUserDto);
  }

  @Delete('users/:id')
  @Auth(Role.ADMIN)
  deleteUser(
    @Param('id') id: string
  ) {
    return this.authService.deleteUser(+id);
  }

  @Put('profile/password')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar mi propia contraseña' })
  updatePassword(
    @GetUser() user: User, 
    @Body() dto: UpdatePasswordDto
  ) {
    return this.authService.updatePassword(user.id, dto);
  }

  @Post('recover-password')
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  recoverPassword(
    @Body() dto: RecoverPasswordDto
  ) {
    return this.authService.recoverPassword(dto);
  }

  @Get('check-status')
  @Auth()
  checkAuthStatus(
    @GetUser() user: User
  ) {
    return this.authService.checkAuthStatus(user);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Restablecer contraseña con token' })
  @ApiResponse({ status: 200, description: 'Contraseña actualizada' })
  resetPassword(
    @Body() dto: ResetPasswordDto
  ) {
    return this.authService.resetPassword(dto.token, dto.password);
  }
}
