import { Controller, Post, Body, Get, Put, Delete, Param, ParseEnumPipe, ParseIntPipe, Query, ValidationPipe, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiParam, ApiResponse, ApiTags, ApiQuery, ApiBody } from '@nestjs/swagger';
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
  @ApiOperation({ 
    summary: 'Registrar nuevo usuario',
    description: 'Registra un nuevo usuario en el sistema. Se puede incluir opcionalmente una imagen de perfil.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Usuario registrado exitosamente', 
    type: LoginResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos inválidos o el usuario ya existe' 
  })
  @ApiResponse({ 
    status: 500, 
    description: 'Error en el servidor durante el registro' 
  })
  @UseInterceptors(FileInterceptor('profileImage', { 
    storage: diskStorage({
      destination: './public/uploads/profile-images',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter, 
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos de registro del usuario con imagen de perfil opcional',
    type: RegisterUserDto
  })
  register(
    @Body(ValidationPipe) dto: RegisterUserDto,
    @UploadedFile() profileImage?: any 
  ) {
    return this.authService.register(dto, profileImage);
  }

  @Post('login')
  @ApiOperation({ 
    summary: 'Iniciar sesión',
    description: 'Inicia sesión con email y contraseña para obtener tokens de acceso y refresco'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Inicio de sesión exitoso', 
    type: LoginResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Credenciales inválidas' 
  })
  @ApiBody({
    description: 'Credenciales de inicio de sesión',
    type: LoginUserDto
  })
  login(
    @Body(ValidationPipe) dto: LoginUserDto
  ): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh-token')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Refrescar token de acceso',
    description: 'Utiliza el token de refresco para obtener un nuevo token de acceso cuando éste expira'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Nuevos tokens generados exitosamente', 
    type: LoginResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Refresh token inválido o expirado' 
  })
  async refreshToken(@Req() req: any) {
    const userRefreshToken = req.user.refreshToken;
    return this.authService.handleRefreshToken(userRefreshToken);
  }

  @Get('profile')
  @Auth(Role.ADMIN, Role.USER)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obtener perfil del usuario logueado',
    description: 'Devuelve los datos del perfil del usuario actualmente autenticado'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Perfil del usuario obtenido exitosamente',
    schema: {
      properties: {
        id: { type: 'number' },
        email: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string', enum: ['ADMIN', 'USER'] },
        profile_image: { type: 'string', nullable: true },
        is_active: { type: 'boolean' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  getProfile(
    @GetUser() user: User
  ) {
    return user;
  }

  @Get('users')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Obtener listado de usuarios',
    description: 'Retorna un listado paginado de usuarios con opciones de filtrado. Solo accesible para administradores.'
  })
  @ApiQuery({ 
    name: 'name', 
    required: false, 
    description: 'Filtrar por nombre (parcial)' 
  })
  @ApiQuery({ 
    name: 'email', 
    required: false, 
    description: 'Filtrar por email (parcial)' 
  })
  @ApiQuery({ 
    name: 'role', 
    required: false, 
    description: 'Filtrar por rol',
    enum: Role
  })
  @ApiQuery({ 
    name: 'is_active', 
    required: false, 
    description: 'Filtrar por estado (activo/inactivo)',
    type: Boolean
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    description: 'Número de página',
    type: Number
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    description: 'Resultados por página',
    type: Number
  })
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
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Prohibido - El usuario no tiene rol de ADMIN' 
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
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obtener un usuario por ID',
    description: 'Devuelve los datos completos de un usuario específico. Solo accesible para administradores.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del usuario a consultar',
    type: Number
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Usuario encontrado',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Usuario no encontrado' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Prohibido - El usuario no tiene rol de ADMIN' 
  })
  getUserById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.authService.getUserById(id);
  }

  @Post('users')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Crear un nuevo usuario (admin)',
    description: 'Crea un nuevo usuario desde el panel de administración. Permite especificar rol y otros datos adicionales.'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Usuario creado exitosamente', 
    type: UserResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos inválidos o usuario ya existe' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Prohibido - El usuario no tiene rol de ADMIN' 
  })
  @UseInterceptors(FileInterceptor('profileImage', {
    storage: diskStorage({
      destination: './public/uploads/profile-images',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos del nuevo usuario con imagen de perfil opcional',
    type: CreateUserDto
  })
  createUser(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() profileImage?: any
  ) {
    return this.authService.createUser(createUserDto, profileImage);
  }

  @Put('users/:id')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Actualizar un usuario',
    description: 'Actualiza los datos de un usuario existente. Solo accesible para administradores.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del usuario a actualizar',
    type: Number
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Usuario actualizado exitosamente',
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos inválidos' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Usuario no encontrado' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Prohibido - El usuario no tiene rol de ADMIN' 
  })
  @UseInterceptors(FileInterceptor('profileImage', {
    storage: diskStorage({
      destination: './public/uploads/profile-images',
      filename: editFileName,
    }),
    fileFilter: imageFileFilter,
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos a actualizar del usuario con imagen de perfil opcional',
    type: UpdateUserDto
  })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() profileImage?: any
  ) {
    return this.authService.updateUser(id, updateUserDto, profileImage);
  }

  @Delete('users/:id')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Eliminar un usuario',
    description: 'Elimina un usuario del sistema. Solo accesible para administradores.'
  })
  @ApiParam({ 
    name: 'id', 
    description: 'ID del usuario a eliminar',
    type: Number
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Usuario eliminado exitosamente',
    schema: {
      properties: {
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Usuario no encontrado' 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'No se puede eliminar el usuario porque tiene datos asociados' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Prohibido - El usuario no tiene rol de ADMIN' 
  })
  deleteUser(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.authService.deleteUser(id);
  }

  @Put('profile/password')
  @Auth()
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Cambiar mi propia contraseña',
    description: 'Permite al usuario cambiar su propia contraseña. Requiere la contraseña actual para validación.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contraseña actualizada exitosamente',
    schema: {
      properties: {
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos inválidos o contraseña actual incorrecta' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiBody({
    description: 'Datos para cambio de contraseña',
    type: UpdatePasswordDto
  })
  updatePassword(
    @GetUser() user: User,
    @Body() dto: UpdatePasswordDto
  ) {
    return this.authService.updatePassword(user.id, dto);
  }

  @Post('recover-password')
  @ApiOperation({ 
    summary: 'Solicitar recuperación de contraseña',
    description: 'Envía un correo electrónico con un enlace para restablecer la contraseña'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Correo de recuperación enviado exitosamente',
    schema: {
      properties: {
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Usuario no encontrado' 
  })
  @ApiBody({
    description: 'Email del usuario que solicita recuperación',
    type: RecoverPasswordDto
  })
  recoverPassword(
    @Body() dto: RecoverPasswordDto
  ) {
    return this.authService.recoverPassword(dto);
  }

  @Get('check-status')
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Verificar estado de autenticación',
    description: 'Verifica si el token de acceso es válido y devuelve nuevos tokens si es necesario'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado verificado y nuevos tokens generados', 
    type: LoginResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado - Token inválido o expirado' 
  })
  checkAuthStatus(
    @GetUser() user: User
  ) {
    return this.authService.checkAuthStatus(user);
  }

  @Post('reset-password')
  @ApiOperation({ 
    summary: 'Restablecer contraseña con token',
    description: 'Restablece la contraseña utilizando el token recibido por correo electrónico'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contraseña actualizada exitosamente',
    schema: {
      properties: {
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Token inválido o expirado' 
  })
  @ApiBody({
    description: 'Token de recuperación y nueva contraseña',
    type: ResetPasswordDto
  })
  resetPassword(
    @Body() dto: ResetPasswordDto
  ) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('roles/:role/modules')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiParam({ 
    name: 'role', 
    enum: Role, 
    description: 'El rol a consultar' 
  })
  @ApiOperation({ 
    summary: 'Obtener los módulos accesibles por rol',
    description: 'Devuelve una lista de los módulos (paths) a los que un rol específico tiene acceso. Solo para administradores.'
  })
  @ApiResponse({
    status: 200, 
    description: 'Lista de módulos', 
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['auth', 'persons', 'zones']
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Prohibido - El usuario no tiene rol de ADMIN' 
  })
  getModulesForRole(
    @Param('role', new ParseEnumPipe(Role)) role: Role,
  ): string[] {
    return this.rolesService.getModulesForRole(role);
  }
}
