import { Controller, Post, Body, Get, Put, Delete, Param, ParseEnumPipe, ParseIntPipe, Query, ValidationPipe, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  UserResponseDto,
  AssignVehiclesToUserDto,
  UserVehicleResponseDto
} from './dto/';
import { GetUser } from './decorators/get-user.decorator';
import { Auth } from './decorators/auth.decorator';
import { RolesService } from './roles.service';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { fileUploadConfigs } from '../common/utils/file-upload.util';

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
  @UseInterceptors(FileInterceptor('profileImage', fileUploadConfigs.profileImages))
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
    type: UserResponseDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  async getProfile(
    @GetUser() user: User
  ): Promise<UserResponseDto> {
    return await this.authService.getUserById(user.id);
  }

  @Get('users')
  @Auth(Role.ADMIN)
  @ApiOperation({ 
    summary: 'Obtener listado de usuarios',
    description: 'Retorna un listado paginado de usuarios con opciones de filtrado. Solo accesible para administradores.'
  })
  @ApiQuery({ 
    name: 'search', 
    required: false, 
    description: 'Filtrar por nombre o email (parcial)' 
  })
  @ApiQuery({ 
    name: 'role', 
    required: false, 
    description: 'Filtrar por rol',
    enum: Role
  })
  @ApiQuery({ 
    name: 'isActive', 
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
  @ApiQuery({ 
    name: 'sortBy', 
    required: false, 
    description: "Campos para ordenar. Prefijo '-' para descendente. Ej: name,-createdAt", 
    example: 'name,-createdAt',
    type: String 
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
          },
          whitelist: true,
          forbidNonWhitelisted: true
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
    description: 'Devuelve los detalles de un usuario específico. Solo accesible para administradores.'
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Usuario encontrado exitosamente', 
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
    summary: 'Crear un nuevo usuario (Admin)',
    description: 'Permite a un administrador crear un nuevo usuario con rol y estado específicos. Se puede incluir imagen de perfil.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Usuario creado exitosamente por Admin', 
    type: UserResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Datos inválidos o el usuario ya existe' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Prohibido - El usuario no tiene rol de ADMIN' 
  })
  @UseInterceptors(FileInterceptor('profileImage', fileUploadConfigs.profileImages))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos para crear un nuevo usuario, incluyendo rol e imagen de perfil opcional.',
    type: CreateUserDto,
  })
  createUser(
    @Body(ValidationPipe) createUserDto: CreateUserDto,
    @UploadedFile() profileImage?: any
  ) {
    return this.authService.createUser(createUserDto, profileImage);
  }
  
  @Put('users/:id')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Actualizar un usuario (Admin)',
    description: 'Permite a un administrador actualizar los datos de un usuario, incluyendo su rol y estado. Se puede incluir imagen de perfil.' 
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a actualizar', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Usuario actualizado exitosamente por Admin', 
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
  @UseInterceptors(FileInterceptor('profileImage', fileUploadConfigs.profileImages))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos para actualizar el usuario. Todos los campos son opcionales.',
    type: UpdateUserDto,
  })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @UploadedFile() profileImage?: any
  ) {
    return this.authService.updateUser(id, updateUserDto, profileImage);
  }

  @Delete('users/:id')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Eliminar un usuario (Admin)',
    description: 'Permite a un administrador eliminar un usuario. Esta acción es irreversible.' 
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a eliminar', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Usuario eliminado exitosamente por Admin', 
    schema: { properties: { message: { type: 'string' } } } 
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
  deleteUser(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.authService.deleteUser(id);
  }

  @Post('update-password')
  @Auth(Role.USER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Actualizar contraseña del usuario logueado',
    description: 'Permite al usuario actualmente autenticado cambiar su propia contraseña.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contraseña actualizada exitosamente', 
    schema: { properties: { message: { type: 'string' } } } 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Contraseña actual incorrecta o nueva contraseña inválida' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  updatePassword(
    @GetUser() user: User,
    @Body(ValidationPipe) dto: UpdatePasswordDto
  ) {
    return this.authService.updatePassword(user.id, dto);
  }

  @Post('recover-password')
  @ApiOperation({ 
    summary: 'Iniciar recuperación de contraseña',
    description: 'Envía un correo electrónico al usuario con un enlace para restablecer su contraseña.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Si el email existe, se enviarán instrucciones de recuperación', 
    schema: { properties: { message: { type: 'string' } } } 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Email no encontrado (aunque el mensaje de éxito es genérico por seguridad)' 
  })
  recoverPassword(
    @Body(ValidationPipe) dto: RecoverPasswordDto
  ) {
    return this.authService.recoverPassword(dto);
  }

  @Post('reset-password') 
  @ApiOperation({ 
    summary: 'Restablecer contraseña olvidada',
    description: 'Restablece la contraseña del usuario utilizando el token de recuperación enviado por correo.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Contraseña restablecida exitosamente', 
    schema: { properties: { message: { type: 'string' } } } 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Token inválido, expirado o nueva contraseña inválida' 
  })
  resetPassword(
    @Body(ValidationPipe) dto: ResetPasswordDto
  ) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Get('check')
  @Auth(Role.ADMIN, Role.USER) 
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Verificar estado de autenticación y obtener nuevos tokens',
    description: 'Verifica si el token de acceso actual es válido y devuelve un nuevo conjunto de tokens (acceso y refresco) junto con los datos del usuario.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Estado de autenticación verificado, tokens actualizados', 
    type: LoginResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'No autorizado' 
  })
  checkAuthStatus(
    @GetUser() user: User
  ) {
    return this.authService.checkAuthStatus(user);
  }

  @Get('roles/:role/modules')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obtener módulos permitidos para un rol (Admin)',
    description: 'Devuelve una lista de módulos/rutas a los que un rol específico tiene acceso. Solo para administradores.'
  })
  @ApiParam({ name: 'role', description: 'Rol a consultar', enum: Role })
  @ApiResponse({ 
    status: 200, 
    description: 'Módulos para el rol obtenidos',
    type: [String]
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

  // Endpoints de gestión de vehículos

  @Post('users/:id/vehicles')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Asignar vehículos a un usuario',
    description: 'Asigna uno o más vehículos a un usuario para que pueda manejarlos. Se pueden desactivar asignaciones previas.'
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', type: Number })
  @ApiResponse({ 
    status: 201, 
    description: 'Vehículos asignados correctamente.', 
    type: [UserVehicleResponseDto] 
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos o vehículos no encontrados.' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  assignVehiclesToUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body(ValidationPipe) dto: AssignVehiclesToUserDto
  ): Promise<UserVehicleResponseDto[]> {
    return this.authService.assignVehiclesToUser(userId, dto);
  }

  @Get('users/:id/vehicles')
  @Auth(Role.ADMIN, Role.USER)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Obtener vehículos asignados a un usuario',
    description: 'Lista todos los vehículos que puede manejar un usuario específico.'
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', type: Number })
  @ApiQuery({ 
    name: 'activeOnly', 
    required: false, 
    type: Boolean, 
    description: 'Solo mostrar asignaciones activas', 
    example: true 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de vehículos del usuario.', 
    type: [UserVehicleResponseDto] 
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getUserVehicles(
    @Param('id', ParseIntPipe) userId: number,
    @Query('activeOnly') activeOnly?: boolean
  ): Promise<UserVehicleResponseDto[]> {
    return this.authService.getUserVehicles(userId, activeOnly ?? true);
  }

  @Delete('users/:userId/vehicles/:vehicleId')
  @Auth(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Remover vehículo de un usuario',
    description: 'Desactiva la asignación de un vehículo específico a un usuario.'
  })
  @ApiParam({ name: 'userId', description: 'ID del usuario', type: Number })
  @ApiParam({ name: 'vehicleId', description: 'ID del vehículo', type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Vehículo removido correctamente.', 
    schema: { 
      properties: { 
        message: { type: 'string' }, 
        removed: { type: 'boolean' } 
      } 
    } 
  })
  @ApiResponse({ status: 404, description: 'Usuario o asignación no encontrada.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({ status: 403, description: 'Prohibido - El usuario no tiene rol de ADMIN.' })
  removeVehicleFromUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('vehicleId', ParseIntPipe) vehicleId: number
  ): Promise<{ message: string, removed: boolean }> {
    return this.authService.removeVehicleFromUser(userId, vehicleId);
  }
}
