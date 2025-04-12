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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService) { }

  @Post('register')
  register(
    @Body() registerUserDto: RegisterUserDto
  ) {
    return this.authService.register(registerUserDto);
  }

  @Post('login')
  login(
    @Body() loginUserDto: LoginUserDto
  ) {
    return this.authService.login(loginUserDto);
  }

  @Get('profile')
  @Auth()
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
  updatePassword(
    @GetUser() user: User,
    @Body() updatePasswordDto: UpdatePasswordDto
  ) {
    return this.authService.updatePassword(user.id, updatePasswordDto);
  }

  @Post('recover-password')
  recoverPassword(
    @Body() recoverPasswordDto: RecoverPasswordDto
  ) {
    return this.authService.recoverPassword(recoverPasswordDto);
  }

  @Get('check-status')
  @Auth()
  checkAuthStatus(
    @GetUser() user: User
  ) {
    return this.authService.checkAuthStatus(user);
  }

  @Post('reset-password')
  resetPassword(
    @Query('token') token: string,
    @Body('password') password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }
}
