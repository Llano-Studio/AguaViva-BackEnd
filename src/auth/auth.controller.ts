import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  Delete,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Query,
  ValidationPipe,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
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
  UserVehicleResponseDto,
} from './dto/';
import { GetUser } from './decorators/get-user.decorator';
import { Auth } from './decorators/auth.decorator';
import { RolesService } from './roles.service';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { fileUploadConfigs } from '../common/utils/file-upload.util';
import { FormDataBody } from '../common/decorators/form-data-body.decorator';
import { CleanupFileOnErrorInterceptor } from '../common/interceptors/validate-before-upload.interceptor';
import { BUSINESS_CONFIG } from '../common/config/business.config';
import { CentralJwtSsoGuard } from './guards/central-jwt-sso.guard';
import { SsoRequest } from './interfaces/central-sso-payload.interface';

@ApiTags('🔐 Autenticación/Usuarios')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rolesService: RolesService,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar nuevo usuario',
    description:
      'Registra un nuevo usuario en el sistema. Se puede incluir opcionalmente una imagen de perfil.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o el usuario ya existe',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'El email debe ser válido',
            'La contraseña debe tener al menos 8 caracteres',
            'El nombre es requerido',
            'El usuario con este email ya existe',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto - El usuario ya existe',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'Ya existe un usuario con este email',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'Error interno del servidor durante el registro',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('profileImage', fileUploadConfigs.profileImages),
    CleanupFileOnErrorInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Datos de registro del usuario con imagen de perfil opcional',
    type: RegisterUserDto,
  })
  register(
    @FormDataBody(RegisterUserDto) dto: RegisterUserDto,
    @UploadedFile() profileImage?: any,
  ) {
    return this.authService.register(dto, profileImage);
  }

  @Post('login')
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Inicia sesión con email y contraseña para obtener tokens de acceso y refresco',
  })
  @ApiResponse({
    status: 200,
    description: 'Inicio de sesión exitoso',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['El email debe ser válido', 'La contraseña es requerida'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Credenciales inválidas' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Usuario inactivo o email no confirmado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'Usuario inactivo o email no confirmado',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiBody({
    description: 'Credenciales de inicio de sesión',
    type: LoginUserDto,
  })
  login(@Body(ValidationPipe) dto: LoginUserDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Get('sso/entry')
  @UseGuards(CentralJwtSsoGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Entrada SSO',
    description:
      'Valida el JWT central emitido por login-service y devuelve tokens locales del modulo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesion SSO validada y tokens locales generados',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token central invalido o ausente' })
  @ApiResponse({
    status: 403,
    description: 'Usuario sin acceso al sistema (audience/assignedSystem)',
  })
  ssoEntry(@Req() req: SsoRequest) {
    if (!req.centralUser) {
      throw new UnauthorizedException('Sesion central no disponible');
    }

    return this.authService.issueSsoSession({
      userId: req.centralUser.userId,
      email: req.centralUser.email,
      assignedSystem: req.centralUser.assignedSystem,
      name: req.centralUser.name,
      role: req.centralUser.role,
    });
  }

  @Post('refresh-token')
  @UseGuards(JwtRefreshGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refrescar token de acceso',
    description:
      'Utiliza el token de refresco para obtener un nuevo token de acceso cuando éste expira',
  })
  @ApiResponse({
    status: 200,
    description: 'Nuevos tokens generados exitosamente',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Refresh token inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: {
          type: 'string',
          example: 'Refresh token inválido o expirado',
        },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Token de refresco no proporcionado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: { type: 'string', example: 'Token de refresco requerido' },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  async refreshToken(@Req() req: any) {
    const userRefreshToken = req.user.refreshToken;
    return this.authService.handleRefreshToken(userRefreshToken);
  }

  @Get('profile')
  @Auth(Role.SUPERADMIN, Role.ADMINISTRATIVE, Role.BOSSADMINISTRATIVE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener perfil del usuario logueado',
    description:
      'Devuelve los datos del perfil del usuario actualmente autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario obtenido exitosamente',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Token inválido o expirado' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - Usuario sin permisos suficientes',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'No tienes permisos para acceder a este recurso',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  async getProfile(@GetUser() user: User): Promise<UserResponseDto> {
    return await this.authService.getUserById(user.id);
  }

  @Get('users')
  @Auth(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Obtener listado de usuarios',
    description:
      'Retorna un listado paginado de usuarios con opciones de filtrado. Solo accesible para SUPERADMINistradores.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filtrar por nombre o email (parcial)',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    description: 'Filtrar por rol (para compatibilidad)',
    enum: Role,
  })
  @ApiQuery({
    name: 'roles',
    required: false,
    description:
      'Filtrar por roles múltiples. Formato: "SUPERADMIN,ADMINISTRATIVE" o array',
    enum: Role,
    isArray: true,
    example: 'SUPERADMIN,ADMINISTRATIVE',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filtrar por estado (activo/inactivo)',
    type: Boolean,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Número de página',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Resultados por página',
    type: Number,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description:
      "Campos para ordenar. Prefijo '-' para descendente. Ej: name,-createdAt",
    example: 'name,-createdAt',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Listado de usuarios paginado',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/UserResponseDto' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de consulta inválidos',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'page debe ser un número positivo',
            `limit debe estar entre 1 y ${BUSINESS_CONFIG.PAGINATION.MAX_LIMIT}`,
            'role debe ser un valor válido del enum Role',
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Token inválido o expirado' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'Acceso denegado. Se requiere rol de SUPERADMIN',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  getAllUsers(
    @Query(
      new ValidationPipe({
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    filterDto: FilterUsersDto,
  ) {
    return this.authService.getAllUsers(filterDto);
  }

  @Get('users/:id')
  @Auth(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener un usuario por ID',
    description:
      'Devuelve los detalles de un usuario específico. Solo accesible para SUPERADMINistradores.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado exitosamente',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'ID de usuario inválido',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'El ID debe ser un número válido' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token inválido o expirado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 401 },
        message: { type: 'string', example: 'Token inválido o expirado' },
        error: { type: 'string', example: 'Unauthorized' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'Acceso denegado. Se requiere rol de SUPERADMIN',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          example: 'Usuario con ID 123 no encontrado',
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.authService.getUserById(id);
  }

  @Post('users')
  @Auth(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Crear un nuevo usuario (SUPERADMIN)',
    description:
      'Permite a un SUPERADMINistrador crear un nuevo usuario con rol y estado específicos. Se puede incluir imagen de perfil.',
  })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado exitosamente por SUPERADMIN',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o el usuario ya existe',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN',
  })
  @UseInterceptors(
    FileInterceptor('profileImage', fileUploadConfigs.profileImages),
    CleanupFileOnErrorInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Datos para crear un nuevo usuario, incluyendo rol e imagen de perfil opcional.',
    type: CreateUserDto,
  })
  createUser(
    @FormDataBody(CreateUserDto) createUserDto: CreateUserDto,
    @UploadedFile() profileImage?: any,
  ) {
    return this.authService.createUser(createUserDto, profileImage);
  }

  @Put('users/:id')
  @Auth(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar un usuario (SUPERADMIN)',
    description:
      'Permite a un SUPERADMINistrador actualizar los datos de un usuario, incluyendo su rol y estado. Se puede incluir imagen de perfil.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario a actualizar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente por SUPERADMIN',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN',
  })
  @UseInterceptors(
    FileInterceptor('profileImage', fileUploadConfigs.profileImages),
    CleanupFileOnErrorInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Datos para actualizar el usuario. Todos los campos son opcionales.',
    type: UpdateUserDto,
  })
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @FormDataBody(UpdateUserDto) updateUserDto: UpdateUserDto,
    @UploadedFile() profileImage?: any,
  ) {
    return this.authService.updateUser(id, updateUserDto, profileImage);
  }

  @Delete('users/:id')
  @Auth(Role.SUPERADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Eliminar un usuario (SUPERADMIN)',
    description:
      'Permite a un SUPERADMINistrador eliminar un usuario. Esta acción es irreversible.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario a eliminar',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario eliminado exitosamente por SUPERADMIN',
    schema: { properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN',
  })
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.authService.deleteUser(id);
  }

  @Post('update-password')
  @Auth(
    Role.ADMINISTRATIVE,
    Role.SUPERADMIN,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar contraseña del usuario logueado',
    description:
      'Permite al usuario actualmente autenticado cambiar su propia contraseña.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
    schema: { properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 400,
    description: 'Contraseña actual incorrecta o nueva contraseña inválida',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  updatePassword(
    @GetUser() user: User,
    @Body(ValidationPipe) dto: UpdatePasswordDto,
  ) {
    return this.authService.updatePassword(user.id, dto);
  }

  @Post('recover-password')
  @ApiOperation({
    summary: 'Iniciar recuperación de contraseña',
    description:
      'Envía un correo electrónico al usuario con un enlace para restablecer su contraseña.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Si el email existe, se enviarán instrucciones de recuperación',
    schema: { properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 404,
    description:
      'Email no encontrado (aunque el mensaje de éxito es genérico por seguridad)',
  })
  recoverPassword(@Body(ValidationPipe) dto: RecoverPasswordDto) {
    return this.authService.recoverPassword(dto);
  }

  @Post('reset-password')
  @ApiOperation({
    summary: 'Restablecer contraseña olvidada',
    description:
      'Restablece la contraseña del usuario utilizando el token de recuperación enviado por correo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña restablecida exitosamente',
    schema: { properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 400,
    description: 'Token inválido, expirado o nueva contraseña inválida',
  })
  resetPassword(@Body(ValidationPipe) dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Post('confirm-email')
  @ApiOperation({
    summary: 'Confirmar email del usuario',
    description:
      'Confirma el email del usuario utilizando el token enviado por correo electrónico.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email confirmado exitosamente',
    schema: { properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 400,
    description: 'Token inválido, expirado o email ya confirmado',
  })
  @ApiBody({
    description: 'Token de confirmación de email',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'Token de confirmación recibido por email',
        },
      },
      required: ['token'],
    },
  })
  confirmEmail(@Body('token') token: string) {
    return this.authService.confirmEmail(token);
  }

  @Post('resend-confirmation')
  @ApiOperation({
    summary: 'Reenviar email de confirmación',
    description:
      'Reenvía el email de confirmación al usuario logueado si aún no ha confirmado su email.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email de confirmación reenviado exitosamente',
    schema: { properties: { message: { type: 'string' } } },
  })
  @ApiResponse({
    status: 400,
    description: 'El email ya está confirmado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async resendConfirmation(@GetUser() user: User) {
    await this.authService.sendEmailConfirmation(user.id);
    return { message: 'Email de confirmación reenviado exitosamente.' };
  }

  @Get('check')
  @ApiOperation({
    summary: 'Verificar estado de autenticación y obtener nuevos tokens',
    description:
      'Verifica si el token de acceso actual es válido y devuelve un nuevo conjunto de tokens (acceso y refresco) junto con los datos del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado de autenticación verificado, tokens actualizados',
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  checkAuthStatus(@GetUser() user: User) {
    return this.authService.checkAuthStatus(user);
  }

  @Get('roles/:role/modules')
  @Auth(
    Role.SUPERADMIN,
    Role.ADMINISTRATIVE,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener módulos permitidos para un rol (SUPERADMIN)',
    description:
      'Devuelve una lista de módulos/rutas a los que un rol específico tiene acceso. Solo para SUPERADMINistradores.',
  })
  @ApiParam({ name: 'role', description: 'Rol a consultar', enum: Role })
  @ApiResponse({
    status: 200,
    description: 'Módulos para el rol obtenidos',
    type: [String],
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN',
  })
  getModulesForRole(
    @Param('role', new ParseEnumPipe(Role)) role: Role,
  ): string[] {
    return this.rolesService.getModulesForRole(role);
  }

  // Endpoints de gestión de vehículos

  @Post('users/:id/vehicles')
  @Auth(
    Role.SUPERADMIN,
    Role.ADMINISTRATIVE,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Asignar vehículos a un usuario',
    description: `🆕 LÓGICA ADITIVA: Asigna uno o más vehículos a un usuario SIN eliminar asignaciones previas.

## Comportamiento Mejorado:

**Asignaciones Aditivas:**
- Si el usuario ya tiene vehículos asignados, los nuevos se AGREGAN a la lista existente
- NO se eliminan ni desactivan las asignaciones previas
- Los vehículos se acumulan progresivamente

**Prevención de Duplicados:**
- Si el vehículo ya está asignado al usuario y activo, NO se duplica
- Se mantiene la fecha de asignación original (\`assigned_at\`)
- Solo se actualizan las notas si son diferentes

**Reactivación Inteligente:**
- Si existe una asignación inactiva, se reactiva en lugar de crear una nueva
- Al reactivar, SÍ se actualiza la fecha de asignación

## Ejemplo:
- Usuario tiene vehículo #1 asignado
- Se envía POST con vehículo #2
- Resultado: Usuario tiene vehículos #1 y #2 asignados`,
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', type: Number })
  @ApiResponse({
    status: 201,
    description: 'Vehículos asignados correctamente de forma aditiva.',
    type: [UserVehicleResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos o vehículos no encontrados.',
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene permisos suficientes.',
  })
  assignVehiclesToUser(
    @Param('id', ParseIntPipe) userId: number,
    @Body(ValidationPipe) dto: AssignVehiclesToUserDto,
  ): Promise<UserVehicleResponseDto[]> {
    return this.authService.assignVehiclesToUser(userId, dto);
  }

  @Get('users/:id/vehicles')
  @Auth(
    Role.SUPERADMIN,
    Role.ADMINISTRATIVE,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obtener vehículos asignados a un usuario',
    description:
      'Lista todos los vehículos que puede manejar un usuario específico.',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario', type: Number })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Solo mostrar asignaciones activas',
    example: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de vehículos del usuario.',
    type: [UserVehicleResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado.' })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  getUserVehicles(
    @Param('id', ParseIntPipe) userId: number,
    @Query('activeOnly') activeOnly?: boolean,
  ): Promise<UserVehicleResponseDto[]> {
    return this.authService.getUserVehicles(userId, activeOnly ?? true);
  }

  @Delete('users/:userId/vehicles/:vehicleId')
  @Auth(
    Role.SUPERADMIN,
    Role.ADMINISTRATIVE,
    Role.BOSSADMINISTRATIVE,
    Role.DRIVERS,
  )
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remover vehículo de un usuario',
    description:
      'Desactiva la asignación de un vehículo específico a un usuario.',
  })
  @ApiParam({ name: 'userId', description: 'ID del usuario', type: Number })
  @ApiParam({ name: 'vehicleId', description: 'ID del vehículo', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Vehículo removido correctamente.',
    schema: {
      properties: {
        message: { type: 'string' },
        removed: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario o asignación no encontrada.',
  })
  @ApiResponse({ status: 401, description: 'No autorizado.' })
  @ApiResponse({
    status: 403,
    description: 'Prohibido - El usuario no tiene rol de SUPERADMIN.',
  })
  removeVehicleFromUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('vehicleId', ParseIntPipe) vehicleId: number,
  ): Promise<{ message: string; removed: boolean }> {
    return this.authService.removeVehicleFromUser(userId, vehicleId);
  }
}
