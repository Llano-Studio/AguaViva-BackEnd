import { Controller, Post, Body, Get, Put, Delete, Param, ParseEnumPipe, ParseIntPipe, Query, ValidationPipe, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { AuthService } from './auth.service';
import {
  RegisterUserDto,
  LoginUserDto,
  LoginResponseDto,
  UpdateUserDto,
  UpdatePasswordDto,
  RecoverPasswordDto,
  ResetPasswordDto,
  CreateUserDto,
  FilterUsersDto,
  UserResponseDto
} from './dto/';
import { GetUser } from './decorators/get-user.decorator';
import { Auth } from './decorators/auth.decorator';
import { RolesService } from './roles.service';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

// Función auxiliar para generar nombres de archivo
const editFileName = (req, file, callback) => {
  const name = file.originalname.split('.')[0];
  const fileExtName = extname(file.originalname);
  const randomName = Array(4)
    .fill(null)
    .map(() => Math.round(Math.random() * 16).toString(16))
    .join('');
  callback(null, `${name}-${randomName}${fileExtName}`);
};

// Función auxiliar para filtrar tipos de archivo (opcional pero recomendado)
const imageFileFilter = (req, file, callback) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
    return callback(new Error('¡Solo se permiten archivos de imagen (jpg, jpeg, png, gif)!'), false);
  }
  callback(null, true);
};

@ApiTags('Autenticación/Usuarios')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rolesService: RolesService
  ) { }

  @Post('register')
  @ApiOperation({ summary: 'Registrar nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario registrado', type: LoginResponseDto })
  @UseInterceptors(FileInterceptor('profileImage', { 
    storage: diskStorage({
      destination: './uploads/profile-images',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter, 
  }))
  @ApiConsumes('multipart/form-data') 
  register(
    @Body(ValidationPipe) dto: RegisterUserDto,
    @UploadedFile() profileImage?: any 
  ) {
    return this.authService.register(dto, profileImage);
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Tokens de acceso y refresco', type: LoginResponseDto })
  login(
    @Body(ValidationPipe) dto: LoginUserDto
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh-token')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refrescar token de acceso' })
  @ApiResponse({ status: 200, description: 'Nuevos tokens generados', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o expirado' })
  async refreshToken(@Req() req: any) {
    const userRefreshToken = req.user.refreshToken;
    return this.authService.handleRefreshToken(userRefreshToken);
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
  @ApiOperation({ summary: 'Obtener listado de usuarios con filtros y paginación' })
  @ApiResponse({
    status: 200,
    description: 'Listado de usuarios paginado',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/UserResponseDto' }
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' }
          }
        }
      }
    }
  })
  getAllUsers(
    @Query(
      new ValidationPipe(
        {
          transform: true,
          transformOptions: {
            enableImplicitConversion: true
          }
        }
      ))
    filterDto: FilterUsersDto
  ) {
    return this.authService.getAllUsers(filterDto);
  }

  @Get('users/:id')
  @Auth(Role.ADMIN)
  getUserById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.authService.getUserById(id);
  }

  @Post('users')
  @Auth(Role.ADMIN)
  @ApiOperation({ summary: 'Crear un nuevo usuario (admin)' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos o usuario ya existe' })
  @UseInterceptors(FileInterceptor('profileImage', {
    storage: diskStorage({
      destination: './uploads/profile-images',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
  }))
  @ApiConsumes('multipart/form-data')
  createUser(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() profileImage?: any
  ) {
    return this.authService.createUser(createUserDto, profileImage);
  }

  @Put('users/:id')
  @Auth(Role.ADMIN)
  @UseInterceptors(FileInterceptor('profileImage', {
    storage: diskStorage({
      destination: './uploads/profile-images',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
  }))
  @ApiConsumes('multipart/form-data')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() profileImage?: any
  ) {
    return this.authService.updateUser(id, updateUserDto, profileImage);
  }

  @Delete('users/:id')
  @Auth(Role.ADMIN)
  deleteUser(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.authService.deleteUser(id);
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

  @ApiOperation({ summary: 'Verificar estado de autenticación y obtener nuevos tokens' })
  @ApiResponse({ status: 200, description: 'Estado y nuevos tokens', type: LoginResponseDto })
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

  @Get('roles/:role/modules')
  @ApiParam({ name: 'role', enum: Role, description: 'El rol a consultar' })
  @ApiOperation({ summary: 'Obtener los módulos (paths) accesibles por rol' })
  @ApiResponse({
    status: 200, description: 'Lista de módulos', schema: {
      example: ['auth', 'persons', 'zones']
    }
  })
  @Auth(Role.ADMIN)
  getModulesForRole(
    @Param('role', new ParseEnumPipe(Role)) role: Role,
  ): string[] {
    return this.rolesService.getModulesForRole(role);
  }
}
