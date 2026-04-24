import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { PrismaClient, Role, User, Prisma } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { MailService } from '../mail/mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { UserResponseDto } from './dto/user-response.dto';
import {
  AssignVehiclesToUserDto,
  UserVehicleResponseDto,
} from './dto/assign-vehicles.dto';
import { parseSortByString } from '../common/utils/query-parser.utils';
import { formatBATimestampISO } from '../common/utils/date.utils';
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { buildImageUrl } from '../common/utils/file-upload.util';
import { CentralSsoPayload } from './interfaces/central-sso-payload.interface';
import {
  FilterCentralUsersDto,
  ResetCentralPasswordDto,
  UpdateCentralUserStatusDto,
  UpsertCentralUserAccessDto,
} from './dto/central-user.dto';

type CentralSsoUser = Pick<
  CentralSsoPayload,
  'userId' | 'email' | 'assignedSystem' | 'name' | 'role'
>;

type CentralManagedAccess = {
  system: string;
  role: Role;
  isActive: boolean;
};

type CentralManagedUser = {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt?: string | Date;
  profileImageUrl?: string;
  accesses: CentralManagedAccess[];
};

@Injectable()
export class AuthService extends PrismaClient implements OnModuleInit {
  private readonly entityName = 'Usuario';

  async onModuleInit() {
    await this.$connect();
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  private buildProfileImageUrl(
    profileImageUrl: string | null,
  ): string | undefined {
    return buildImageUrl(profileImageUrl, 'profile-images') || undefined;
  }

  private getModuleSystemCode() {
    return this.configService.get<string>('MODULE_SYSTEM_CODE') || 'AGUAVIVA';
  }

  private getLoginServiceJwtSecret() {
    const secret =
      this.configService.get<string>('LOGIN_SERVICE_JWT_SECRET') ||
      this.configService.get<string>('CENTRAL_AUTH_JWT_SECRET');

    if (!secret) {
      throw new InternalServerErrorException(
        'No se configuró el secreto compartido con login-service.',
      );
    }

    return secret;
  }

  private buildLoginServiceToken(actingUser: User) {
    if (actingUser.centralUserId === null) {
      throw new BadRequestException(
        'El usuario actual no está vinculado a login-service.',
      );
    }

    return this.jwtService.sign(
      {
        userId: actingUser.centralUserId,
        email: actingUser.email,
        name: actingUser.name,
        role: actingUser.role,
        assignedSystem: this.getModuleSystemCode(),
      },
      {
        secret: this.getLoginServiceJwtSecret(),
        expiresIn: '5m',
      },
    );
  }

  private generateJwtToken(
    payload: JwtPayload,
    expiresIn: string | number,
  ): string {
    return this.jwtService.sign(payload, { expiresIn });
  }

  private async generateAndStoreRefreshToken(userId: number): Promise<string> {
    const refreshTokenExpiresIn =
      this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME') ||
      '7d';
    const refreshTokenPayload: JwtPayload = { id: userId };
    const refreshTokenSecret =
      this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      this.configService.get<string>('app.jwt.secret');
    const refreshTokenSignOptions: {
      expiresIn: string | number;
      secret?: string;
    } = { expiresIn: refreshTokenExpiresIn };
    if (refreshTokenSecret) {
      refreshTokenSignOptions.secret = refreshTokenSecret;
    }
    const refreshToken = this.jwtService.sign(
      refreshTokenPayload,
      refreshTokenSignOptions,
    );

    const now = new Date();
    let expiresAt = new Date(now);
    if (typeof refreshTokenExpiresIn === 'string') {
      const daysMatch = refreshTokenExpiresIn.match(/^(\d+)d$/);
      if (daysMatch) {
        expiresAt.setDate(now.getDate() + parseInt(daysMatch[1], 10));
      } else {
        expiresAt.setDate(now.getDate() + 7);
      }
    } else if (typeof refreshTokenExpiresIn === 'number') {
      expiresAt = new Date(now.getTime() + refreshTokenExpiresIn * 1000);
    } else {
      expiresAt.setDate(now.getDate() + 7);
    }

    try {
      await this.refreshToken.create({
        data: {
          token: refreshToken,
          userId: userId,
          expiresAt: expiresAt,
        },
      });
    } catch (error) {
      handlePrismaError(error, 'Token de refresco');
      throw new InternalServerErrorException(
        'Error al guardar el token de refresco.',
      );
    }
    return refreshToken;
  }

  async register(registerUserDto: RegisterUserDto, profileImage?: any) {
    const { email, password, name, isActive, role } = registerUserDto;
    try {
      const existingUser = await this.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException(
          `El ${this.entityName.toLowerCase()} con email '${email}' ya está registrado.`,
        );
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userData: Prisma.UserCreateInput = {
        email,
        password: hashedPassword,
        name,
        role: role || Role.ADMINISTRATIVE,
        isActive: isActive === undefined ? true : isActive,
      };

      if (profileImage?.filename) {
        userData.profileImageUrl = profileImage.filename;
      }

      const user = await this.user.create({ data: userData });

      // Enviar email de confirmación automáticamente
      try {
        await this.sendEmailConfirmation(user.id);
      } catch (emailError) {
        console.warn(
          'Error enviando email de confirmación:',
          emailError.message,
        );
        // No fallar el registro si el email no se puede enviar
      }

      const accessTokenExpiresIn =
        this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') ||
        '4h';
      const accessToken = this.generateJwtToken(
        { id: user.id },
        accessTokenExpiresIn,
      );
      const refreshToken = await this.generateAndStoreRefreshToken(user.id);

      return {
        user: new UserResponseDto({
          id: user.id,
          centralUserId: user.centralUserId,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: formatBATimestampISO(user.createdAt),
          updatedAt: user.updatedAt
            ? formatBATimestampISO(user.updatedAt)
            : undefined,
          profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl),
        }),
        accessToken,
        refreshToken,
        message:
          'Usuario registrado exitosamente. Se ha enviado un email de confirmación.',
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      )
        throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        `Error registrando ${this.entityName.toLowerCase()}.`,
      );
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;
    try {
      const user = await this.user.findUnique({ where: { email } });
      if (!user) {
        throw new UnauthorizedException('Credenciales inválidas.');
      }
      if (user.centralUserId !== null) {
        throw new UnauthorizedException(
          'Este usuario se autentica desde login-service.',
        );
      }
      if (!user.password) {
        throw new UnauthorizedException('Credenciales inválidas.');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Credenciales inválidas.');
      }

      const accessTokenExpiresIn =
        this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') ||
        '4h';
      const accessToken = this.generateJwtToken(
        { id: user.id },
        accessTokenExpiresIn,
      );
      const refreshToken = await this.generateAndStoreRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          centralUserId: user.centralUserId,
          email: user.email,
          name: user.name,
          role: user.role,
          profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl),
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error durante el login.');
    }
  }

  async checkAuthStatus(user: User) {
    try {
      const accessTokenExpiresIn =
        this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') ||
        '4h';
      const accessToken = this.generateJwtToken(
        { id: user.id },
        accessTokenExpiresIn,
      );
      const refreshToken = await this.generateAndStoreRefreshToken(user.id);

      return {
        id: user.id,
        centralUserId: user.centralUserId,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error al verificar el estado de autenticación.',
      );
    }
  }

  async issueSsoSession(centralUser: CentralSsoUser) {
    try {
      const normalizedEmail = centralUser.email.toLowerCase().trim();
      const resolvedName = centralUser.name?.trim() || normalizedEmail;
      const resolvedRole = centralUser.role ?? Role.ADMINISTRATIVE;
      const user = await this.$transaction(async (prisma) => {
        const existingByCentralId = await prisma.user.findUnique({
          where: { centralUserId: centralUser.userId },
          select: { id: true },
        });
        const existingByEmail = existingByCentralId
          ? null
          : await prisma.user.findUnique({
            where: { email: normalizedEmail },
            select: { id: true },
          });
        const userToSync = existingByCentralId ?? existingByEmail;

        if (!userToSync) {
          return prisma.user.create({
            data: {
              centralUserId: centralUser.userId,
              email: normalizedEmail,
              password: null,
              name: resolvedName,
              role: resolvedRole,
              isActive: true,
              isEmailConfirmed: true,
            },
          });
        }

        return prisma.user.update({
          where: { id: userToSync.id },
          data: {
            centralUserId: centralUser.userId,
            email: normalizedEmail,
            name: resolvedName,
            role: resolvedRole,
            isActive: true,
            isEmailConfirmed: true,
            updatedAt: new Date(),
          },
        });
      });

      const accessTokenExpiresIn =
        this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') ||
        '4h';
      const accessToken = this.generateJwtToken(
        { id: user.id },
        accessTokenExpiresIn,
      );
      const refreshToken = await this.generateAndStoreRefreshToken(user.id);

      return {
        sessionType: 'SSO',
        user: {
          id: user.id,
          centralUserId: user.centralUserId,
          email: user.email,
          name: user.name,
          role: user.role,
          system: centralUser.assignedSystem,
          isActive: user.isActive,
          profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl),
        },
        accessToken,
        refreshToken,
      };
    } catch (error) {
      handlePrismaError(error, 'Sesión SSO');
      throw new InternalServerErrorException(
        'Error al inicializar la sesión SSO.',
      );
    }
  }

  async getAllUsers(filters?: FilterUsersDto) {
    try {
      const whereClause: Prisma.UserWhereInput = {
        // Por defecto solo mostrar usuarios activos, a menos que se especifique lo contrario
        isActive: filters?.isActive !== undefined ? filters.isActive : true,
      };
      if (filters) {
        if (filters.search) {
          whereClause.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ];
        }
        // Filtros de roles (múltiples o único)
        if (filters.roles && filters.roles.length > 0) {
          // Si se proporcionan múltiples roles, usar operador IN
          whereClause.role = { in: filters.roles };
        } else if (filters.role) {
          // Si solo se proporciona un rol (compatibilidad), usar equality
          whereClause.role = filters.role;
        }
        // El filtro por isActive ya está configurado arriba
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;

      const totalUsers = await this.user.count({ where: whereClause });
      const orderByClause = parseSortByString(filters?.sortBy, [
        { name: 'asc' },
      ]);

      const users = await this.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          profileImageUrl: true,
        },
        skip,
        take: limit,
        orderBy: orderByClause,
      });

      const userDtos = users.map(
        (user) =>
          new UserResponseDto({
            ...user,
            createdAt: formatBATimestampISO(user.createdAt),
            updatedAt: user.updatedAt
              ? formatBATimestampISO(user.updatedAt)
              : undefined,
            profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl),
          }),
      );

      return {
        data: userDtos,
        meta: {
          total: totalUsers,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalUsers / limit),
        },
      };
    } catch (error) {
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException(
        `Error obteniendo ${this.entityName.toLowerCase()}s.`,
      );
    }
  }

  async getUserById(id: number, includeInactive: boolean = false) {
    try {
      const user = await this.user.findFirst({
        where: {
          id,
          ...(includeInactive ? {} : { isActive: true }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          profileImageUrl: true,
        },
      });

      if (!user) {
        throw new NotFoundException(
          `${this.entityName} con ID ${id} no encontrado.`,
        );
      }
      return new UserResponseDto({
        ...user,
        createdAt: formatBATimestampISO(user.createdAt),
        updatedAt: user.updatedAt
          ? formatBATimestampISO(user.updatedAt)
          : undefined,
        profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl),
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        `Error obteniendo ${this.entityName.toLowerCase()} con ID ${id}.`,
      );
    }
  }

  async updateUser(
    id: number,
    updateUserDto: UpdateUserDto,
    actingUser: User,
    profileImage?: any,
  ) {
    try {
      const userToUpdate = await this.user.findUnique({ where: { id } });
      if (!userToUpdate) {
        throw new NotFoundException(
          `${this.entityName} con ID ${id} no encontrado.`,
        );
      }
      if (userToUpdate.centralUserId === null) {
        throw new BadRequestException(
          'La actualización de usuarios debe realizarse sobre usuarios centralizados en login-service.',
        );
      }

      const centralUser = await this.fetchCentralManagedUser(
        userToUpdate.centralUserId,
        actingUser,
      );
      const currentSystem = this.getModuleSystemCode();
      const mergedAccesses = centralUser.accesses.map((access) =>
        access.system === currentSystem
          ? {
            system: access.system,
            role: updateUserDto.role ?? access.role,
            isActive:
              updateUserDto.isActive === undefined
                ? access.isActive
                : updateUserDto.isActive,
          }
          : access,
      );
      if (!mergedAccesses.some((access) => access.system === currentSystem)) {
        mergedAccesses.push({
          system: currentSystem,
          role: updateUserDto.role ?? Role.ADMINISTRATIVE,
          isActive:
            updateUserDto.isActive === undefined ? true : updateUserDto.isActive,
        });
      }

      const updatedCentralUser = await this.sendMultipartRequestToLoginService(
        'PATCH',
        `users/${userToUpdate.centralUserId}`,
        actingUser,
        {
          email: updateUserDto.email,
          name: updateUserDto.name,
          isActive: updateUserDto.isActive,
          accesses: mergedAccesses,
        },
        profileImage,
      );

      return this.syncCentralManagedUserToLocal(updatedCentralUser);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      )
        throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        `Error actualizando ${this.entityName.toLowerCase()} con ID ${id}.`,
      );
    }
  }

  async deleteUser(id: number) {
    try {
      const userToDelete = await this.user.findUnique({ where: { id } });
      if (!userToDelete) {
        throw new NotFoundException(
          `${this.entityName} con ID ${id} no encontrado.`,
        );
      }
      // Hard delete: eliminar físicamente el registro del usuario
      await this.user.delete({ where: { id } });
      return { message: `${this.entityName} con ID ${id} eliminado.` };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        // Violación de clave foránea: el usuario tiene datos relacionados
        handlePrismaError(
          error,
          `El ${this.entityName.toLowerCase()} con ID ${id} no se puede eliminar porque tiene datos relacionados (ej. hojas de ruta, incidentes, movimientos de stock).`,
        );
      } else {
        handlePrismaError(error, this.entityName);
      }
      throw new InternalServerErrorException(
        `Error eliminando ${this.entityName.toLowerCase()} con ID ${id}.`,
      );
    }
  }

  async updatePassword(userId: number, updatePasswordDto: UpdatePasswordDto) {
    const { currentPassword, newPassword } = updatePasswordDto;
    try {
      const user = await this.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`${this.entityName} no encontrado.`);
      }
      if (user.centralUserId !== null) {
        throw new BadRequestException(
          'La contraseña de este usuario se gestiona en login-service. Consumir el endpoint central PATCH /users/:id/password.',
        );
      }
      if (!user.password) {
        throw new BadRequestException(
          'Este usuario no tiene contraseña local configurada.',
        );
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!isPasswordValid) {
        throw new BadRequestException('La contraseña actual es incorrecta.');
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await this.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword, updatedAt: new Date() },
      });

      return { message: 'Contraseña actualizada correctamente.' };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error actualizando la contraseña.',
      );
    }
  }

  async recoverPassword(recoverPasswordDto: RecoverPasswordDto) {
    const { email } = recoverPasswordDto;
    try {
      const user = await this.user.findUnique({ where: { email } });
      if (!user || user.centralUserId !== null) {
        return this.forwardPasswordRecoveryToLoginService(recoverPasswordDto);
      }

      const recoveryToken = (
        await bcrypt.hash(Math.random().toString(36).substring(2, 15), 10)
      ).replace(/\//g, '');
      const recoveryTokenExpires = new Date(Date.now() + 3600000); // 1 hora

      await this.user.update({
        where: { email },
        data: { recoveryToken, recoveryTokenExpires, updatedAt: new Date() },
      });

      await this.mailService.sendPasswordRecoveryEmail(
        user.email,
        recoveryToken,
      );
      return {
        success: true,
        message:
          'Si el email está registrado, recibirás un correo para recuperar tu contraseña.',
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error durante la recuperación de contraseña.',
      );
    }
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const user = await this.user.findFirst({
        where: {
          recoveryToken: token,
          recoveryTokenExpires: { gt: new Date() },
        },
      });

      if (!user || user.centralUserId !== null) {
        return this.forwardPasswordResetToLoginService(token, newPassword);
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await this.user.update({
        where: { id: user.id },
        data: {
          password: hashedNewPassword,
          recoveryToken: null,
          recoveryTokenExpires: null,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        message: 'Contraseña restablecida correctamente.',
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        'Error restableciendo la contraseña.',
      );
    }
  }

  private getLoginServiceUrl() {
    return (
      this.configService.get<string>('LOGIN_SERVICE_URL') ||
      'http://localhost:3001'
    ).replace(/\/$/, '');
  }

  private async forwardPasswordRecoveryToLoginService(
    recoverPasswordDto: RecoverPasswordDto,
  ) {
    return this.forwardLoginServiceRequest('forgot-password', {
      email: recoverPasswordDto.email,
    });
  }

  private async forwardPasswordResetToLoginService(
    token: string,
    newPassword: string,
  ) {
    return this.forwardLoginServiceRequest('reset-password', {
      token,
      newPassword,
    });
  }

  private async forwardLoginServiceRequest(
    path: string,
    payload: Record<string, unknown>,
  ) {
    const response = await fetch(`${this.getLoginServiceUrl()}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (response.ok) {
      return parsed;
    }

    const message =
      typeof parsed.message === 'string'
        ? parsed.message
        : 'Error delegando la operación a login-service.';

    if (response.status === 400) {
      throw new BadRequestException(message);
    }
    if (response.status === 401) {
      throw new UnauthorizedException(message);
    }
    if (response.status === 404) {
      throw new NotFoundException(message);
    }

    throw new InternalServerErrorException(message);
  }

  private async sendMultipartRequestToLoginService(
    method: 'POST' | 'PATCH',
    path: string,
    actingUser: User,
    payload: Record<string, unknown>,
    profileImage?: any,
  ) {
    const formData = new FormData();

    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      if (key === 'accesses') {
        formData.append(key, JSON.stringify(value));
        continue;
      }
      formData.append(key, String(value));
    }

    try {
      if (profileImage?.path) {
        const fileBuffer = await fs.readFile(profileImage.path);
        formData.append(
          'profileImage',
          new Blob([fileBuffer]),
          profileImage.originalname || profileImage.filename || 'profile-image',
        );
      }

      const response = await fetch(`${this.getLoginServiceUrl()}/${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.buildLoginServiceToken(actingUser)}`,
        },
        body: formData,
      });
      const text = await response.text();
      const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

      if (response.ok) {
        return parsed as CentralManagedUser;
      }

      const message =
        typeof parsed.message === 'string'
          ? parsed.message
          : 'Error delegando la operación a login-service.';

      if (response.status === 400) {
        throw new BadRequestException(message);
      }
      if (response.status === 401) {
        throw new UnauthorizedException(message);
      }
      if (response.status === 404) {
        throw new NotFoundException(message);
      }
      if (response.status === 409) {
        throw new ConflictException(message);
      }

      throw new InternalServerErrorException(message);
    } finally {
      if (profileImage?.path) {
        await fs.unlink(profileImage.path).catch(() => undefined);
      }
    }
  }

  private async fetchCentralManagedUser(
    centralUserId: number,
    actingUser: User,
  ) {
    const response = await fetch(
      `${this.getLoginServiceUrl()}/users/${centralUserId}`,
      {
        headers: {
          Authorization: `Bearer ${this.buildLoginServiceToken(actingUser)}`,
        },
      },
    );
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (response.ok) {
      return parsed as CentralManagedUser;
    }

    const message =
      typeof parsed.message === 'string'
        ? parsed.message
        : 'Error obteniendo usuario central desde login-service.';

    if (response.status === 404) {
      throw new NotFoundException(message);
    }
    if (response.status === 401) {
      throw new UnauthorizedException(message);
    }

    throw new InternalServerErrorException(message);
  }

  private resolveCentralAccessForCurrentSystem(user: CentralManagedUser) {
    const access = user.accesses.find(
      (item) => item.system === this.getModuleSystemCode(),
    );

    if (!access) {
      throw new BadRequestException(
        `El usuario central no tiene acceso al sistema ${this.getModuleSystemCode()}.`,
      );
    }

    return access;
  }

  private async syncCentralManagedUserToLocal(user: CentralManagedUser) {
    const moduleAccess = this.resolveCentralAccessForCurrentSystem(user);
    const localUser = await this.$transaction(async (prisma) => {
      const existingByCentralId = await prisma.user.findUnique({
        where: { centralUserId: user.id },
        select: { id: true },
      });
      const existingByEmail = existingByCentralId
        ? null
        : await prisma.user.findUnique({
          where: { email: user.email.toLowerCase().trim() },
          select: { id: true },
        });
      const userToSync = existingByCentralId ?? existingByEmail;

      if (!userToSync) {
        return prisma.user.create({
          data: {
            centralUserId: user.id,
            email: user.email.toLowerCase().trim(),
            password: null,
            name: user.name,
            role: moduleAccess.role,
            isActive: user.isActive,
            isEmailConfirmed: true,
            profileImageUrl: user.profileImageUrl ?? null,
          },
        });
      }

      return prisma.user.update({
        where: { id: userToSync.id },
        data: {
          centralUserId: user.id,
          email: user.email.toLowerCase().trim(),
          password: null,
          name: user.name,
          role: moduleAccess.role,
          isActive: user.isActive,
          isEmailConfirmed: true,
          profileImageUrl: user.profileImageUrl ?? null,
          updatedAt: new Date(),
        },
      });
    });

    return new UserResponseDto({
      ...localUser,
      createdAt: formatBATimestampISO(localUser.createdAt),
      updatedAt: localUser.updatedAt
        ? formatBATimestampISO(localUser.updatedAt)
        : undefined,
      profileImageUrl: this.buildProfileImageUrl(localUser.profileImageUrl),
    });
  }

  private async forwardJsonToLoginService<T>(
    method: 'GET' | 'PATCH' | 'POST' | 'DELETE',
    path: string,
    actingUser: User,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>,
  ): Promise<T> {
    const queryString = query
      ? (() => {
        const entries = Object.entries(query).filter(
          ([, v]) => v !== undefined && v !== null && v !== '',
        );
        if (entries.length === 0) return '';
        return (
          '?' +
          entries
            .map(
              ([k, v]) =>
                `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
            )
            .join('&')
        );
      })()
      : '';

    const response = await fetch(
      `${this.getLoginServiceUrl()}/${path}${queryString}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${this.buildLoginServiceToken(actingUser)}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );

    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

    if (response.ok) {
      return parsed as T;
    }

    const message =
      typeof parsed.message === 'string'
        ? parsed.message
        : 'Error delegando la operación a login-service.';

    if (response.status === 400) throw new BadRequestException(message);
    if (response.status === 401) throw new UnauthorizedException(message);
    if (response.status === 403) throw new ForbiddenException(message);
    if (response.status === 404) throw new NotFoundException(message);
    if (response.status === 409) throw new ConflictException(message);

    throw new InternalServerErrorException(message);
  }

  async listCentralUsers(actingUser: User, filters: FilterCentralUsersDto) {
    const result = await this.forwardJsonToLoginService<{
      data: CentralManagedUser[];
      meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      };
    }>('GET', 'users', actingUser, undefined, {
      search: filters.search,
      role: filters.role,
      isActive: filters.isActive,
      page: filters.page,
      limit: filters.limit,
      system: this.getModuleSystemCode(),
    });

    const centralIds = result.data.map((u) => u.id);
    const localUsers =
      centralIds.length > 0
        ? await this.user.findMany({
          where: { centralUserId: { in: centralIds } },
          select: { id: true, centralUserId: true },
        })
        : [];

    const localIdByCentralId = new Map(
      localUsers
        .filter((u) => u.centralUserId !== null)
        .map((u) => [u.centralUserId as number, u.id]),
    );

    return {
      ...result,
      data: result.data.map((u) => ({
        ...u,
        id: localIdByCentralId.get(u.id) ?? null,
        centralUserId: u.id,
      })),
    };
  }

  async getCentralUserById(actingUser: User, id: number) {
    return this.forwardJsonToLoginService<CentralManagedUser>(
      'GET',
      `users/${id}`,
      actingUser,
    );
  }

  async updateCentralUserStatus(
    actingUser: User,
    id: number,
    dto: UpdateCentralUserStatusDto,
  ) {
    const updated = await this.forwardJsonToLoginService<CentralManagedUser>(
      'PATCH',
      `users/${id}/status`,
      actingUser,
      { isActive: dto.isActive },
    );
    return this.syncCentralManagedUserToLocal(updated);
  }

  async upsertCentralUserAccess(
    actingUser: User,
    id: number,
    system: string,
    dto: UpsertCentralUserAccessDto,
  ) {
    const updated = await this.forwardJsonToLoginService<CentralManagedUser>(
      'PATCH',
      `users/${id}/accesses/${system}`,
      actingUser,
      { role: dto.role, isActive: dto.isActive },
    );
    if (system === this.getModuleSystemCode()) {
      return this.syncCentralManagedUserToLocal(updated);
    }
    return updated;
  }

  async resetCentralUserPassword(
    actingUser: User,
    id: number,
    dto: ResetCentralPasswordDto,
  ) {
    return this.forwardJsonToLoginService<{ passwordReset: boolean }>(
      'PATCH',
      `users/${id}/password`,
      actingUser,
      {
        currentPassword: dto.currentPassword,
        newPassword: dto.newPassword,
      },
    );
  }

  async createUser(
    createUserDto: CreateUserDto,
    actingUser: User,
    profileImage?: any,
  ) {
    try {
      const accesses =
        createUserDto.accesses && createUserDto.accesses.length > 0
          ? createUserDto.accesses.map((a) => ({
            system: a.system,
            role: a.role,
            isActive: a.isActive === undefined ? true : a.isActive,
          }))
          : [
            {
              system: this.getModuleSystemCode(),
              role: createUserDto.role || Role.ADMINISTRATIVE,
              isActive:
                createUserDto.isActive === undefined
                  ? true
                  : createUserDto.isActive,
            },
          ];

      const createdCentralUser = await this.sendMultipartRequestToLoginService(
        'POST',
        'users',
        actingUser,
        {
          email: createUserDto.email,
          name: createUserDto.name,
          password: createUserDto.password,
          isActive: createUserDto.isActive,
          accesses,
        },
        profileImage,
      );


      const hasLocalAccess = createdCentralUser.accesses.some(
        (a) => a.system === this.getModuleSystemCode(),
      );
      if (hasLocalAccess) {
        return this.syncCentralManagedUserToLocal(createdCentralUser);
      }
      return createdCentralUser;
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      )
        throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        `Error creando ${this.entityName.toLowerCase()}.`,
      );
    }
  }

  async updateCentralUser(
    actingUser: User,
    id: number,
    updateUserDto: UpdateUserDto,
    profileImage?: any,
  ) {
    try {
      const payload: Record<string, unknown> = {};
      if (updateUserDto.email !== undefined) payload.email = updateUserDto.email;
      if (updateUserDto.name !== undefined) payload.name = updateUserDto.name;
      if (updateUserDto.password !== undefined)
        payload.password = updateUserDto.password;
      if (updateUserDto.isActive !== undefined)
        payload.isActive = updateUserDto.isActive;

      if (updateUserDto.accesses && updateUserDto.accesses.length > 0) {
        payload.accesses = updateUserDto.accesses.map((a) => ({
          system: a.system,
          role: a.role,
          isActive: a.isActive === undefined ? true : a.isActive,
        }));
      } else if (updateUserDto.role) {
        payload.accesses = [
          {
            system: this.getModuleSystemCode(),
            role: updateUserDto.role,
            isActive:
              updateUserDto.isActive === undefined
                ? true
                : updateUserDto.isActive,
          },
        ];
      }

      const updatedCentralUser = await this.sendMultipartRequestToLoginService(
        'PATCH',
        `users/${id}`,
        actingUser,
        payload,
        profileImage,
      );

      return this.syncCentralManagedUserToLocal(updatedCentralUser);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException ||
        error instanceof NotFoundException
      )
        throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        `Error actualizando ${this.entityName.toLowerCase()} central.`,
      );
    }
  }

  async validateAndParseRefreshToken(
    token: string,
  ): Promise<JwtPayload | null> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });
      return payload;
    } catch (err) {
      return null;
    }
  }

  async handleRefreshToken(
    oldRefreshTokenString: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const storedRefreshToken = await this.refreshToken.findUnique({
        where: { token: oldRefreshTokenString },
        include: { user: true },
      });

      if (!storedRefreshToken || storedRefreshToken.expiresAt < new Date()) {
        if (storedRefreshToken) {
          await this.refreshToken.delete({
            where: { id: storedRefreshToken.id },
          });
        }
        throw new UnauthorizedException(
          'Token de refresco inválido o expirado.',
        );
      }

      const user = storedRefreshToken.user;
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario inactivo o no encontrado.');
      }

      const accessTokenExpiresIn =
        this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') ||
        '4h';
      const newAccessToken = this.generateJwtToken(
        { id: user.id },
        accessTokenExpiresIn,
      );
      const newRefreshToken = await this.generateAndStoreRefreshToken(user.id);
      await this.refreshToken.delete({ where: { id: storedRefreshToken.id } });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      handlePrismaError(error, 'Token de refresco');
      throw new InternalServerErrorException(
        'Error al procesar el token de refresco.',
      );
    }
  }

  // Métodos para manejo de vehículos

  async assignVehiclesToUser(
    userId: number,
    dto: AssignVehiclesToUserDto,
    actingUser: User,
  ): Promise<UserVehicleResponseDto[]> {
    // 1. Encontrar al usuario localmente por su centralUserId (el origen de verdad para estas operaciones)
    const localUser = await this.user.findUnique({
      where: { centralUserId: userId },
    });

    if (!localUser) {
      throw new NotFoundException(`Usuario con ID Central ${userId} no encontrado en este sistema.`);
    }

    // 2. Verificar que todos los vehículos existen localmente
    const vehicles = await this.vehicle.findMany({
      where: { vehicle_id: { in: dto.vehicleIds } },
    });

    if (vehicles.length !== dto.vehicleIds.length) {
      const foundIds = vehicles.map((v) => v.vehicle_id);
      const missingIds = dto.vehicleIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Los siguientes vehículos no existen localmente: ${missingIds.join(', ')}`,
      );
    }

    try {
      // 3. Enviar la asignación al login-service usando el centralUserId
      const centralAssignments = await this.forwardJsonToLoginService<any[]>(
        'POST',
        `users/${userId}/vehicles`,
        actingUser,
        dto as unknown as Record<string, unknown>,
      );

      // 4. Sincronizar la tabla local
      return await this.$transaction(async (prisma) => {
        const assignments = await Promise.all(
          centralAssignments.map(async (centralAssignment) => {
            const existingAssignment = await prisma.user_vehicle.findUnique({
              where: {
                unique_user_vehicle: {
                  user_id: localUser.id,
                  vehicle_id: centralAssignment.vehicleId,
                },
              },
            });

            if (existingAssignment) {
              return await prisma.user_vehicle.update({
                where: { user_vehicle_id: existingAssignment.user_vehicle_id },
                data: {
                  is_active: centralAssignment.isActive,
                  notes: centralAssignment.notes,
                  assigned_at: centralAssignment.assignedAt,
                },
                include: { vehicle: true, user: true },
              });
            } else {
              return await prisma.user_vehicle.create({
                data: {
                  user_id: localUser.id,
                  vehicle_id: centralAssignment.vehicleId,
                  is_active: centralAssignment.isActive,
                  notes: centralAssignment.notes,
                  assigned_at: centralAssignment.assignedAt,
                },
                include: { vehicle: true, user: true },
              });
            }
          }),
        );

        return assignments.map(this.mapToUserVehicleResponseDto);
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      handlePrismaError(error, 'Asignación de vehículos (Proxy/Sync)');
      throw new InternalServerErrorException(
        'Error al sincronizar la asignación de vehículos.',
      );
    }
  }

  async getUserVehicles(
    userId: number,
    activeOnly: boolean = true,
  ): Promise<UserVehicleResponseDto[]> {
    // 1. Encontrar al usuario localmente por centralUserId
    const localUser = await this.user.findUnique({
      where: { centralUserId: userId },
    });

    if (!localUser) {
      throw new NotFoundException(`Usuario con ID Central ${userId} no encontrado en este sistema.`);
    }

    // 2. Intentar sincronizar desde el origen de verdad
    try {
      const centralAssignments = await this.forwardJsonToLoginService<any[]>(
        'GET',
        `users/${userId}/vehicles?activeOnly=${activeOnly}`,
        null,
      );

      await this.$transaction(async (prisma) => {
        for (const ca of centralAssignments) {
          await prisma.user_vehicle.upsert({
            where: {
              unique_user_vehicle: {
                user_id: localUser.id,
                vehicle_id: ca.vehicleId,
              },
            },
            create: {
              user_id: localUser.id,
              vehicle_id: ca.vehicleId,
              is_active: ca.isActive,
              notes: ca.notes,
              assigned_at: ca.assignedAt,
            },
            update: {
              is_active: ca.isActive,
              notes: ca.notes,
              assigned_at: ca.assignedAt,
            },
          });
        }
      });
    } catch (error) {
      console.warn('Error sincronizando vehículos desde central:', error.message);
    }

    // 3. Retornar datos locales
    const assignments = await this.user_vehicle.findMany({
      where: {
        user_id: localUser.id,
        ...(activeOnly ? { is_active: true } : {}),
      },
      include: {
        vehicle: true,
        user: true,
      },
      orderBy: { assigned_at: 'desc' },
    });

    return assignments.map(this.mapToUserVehicleResponseDto);
  }

  async removeVehicleFromUser(
    userId: number,
    vehicleId: number,
    actingUser: User,
  ): Promise<{ message: string; removed: boolean }> {
    // 1. Encontrar al usuario localmente por centralUserId
    const localUser = await this.user.findUnique({
      where: { centralUserId: userId },
    });

    if (!localUser) {
      throw new NotFoundException(`Usuario con ID Central ${userId} no encontrado.`);
    }

    try {
      // 2. Ejecutar remoción en login-service
      await this.forwardJsonToLoginService(
        'DELETE',
        `users/${userId}/vehicles/${vehicleId}`,
        actingUser,
      );

      // 3. Sincronizar localmente
      await this.user_vehicle.update({
        where: {
          unique_user_vehicle: {
            user_id: localUser.id,
            vehicle_id: vehicleId,
          },
        },
        data: { is_active: false },
      });

      return {
        message: 'Vehículo removido correctamente.',
        removed: true,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      handlePrismaError(error, 'Remoción de vehículo (Proxy/Sync)');
      throw new InternalServerErrorException(
        'Error al sincronizar la remoción del vehículo.',
      );
    }
  }

  async getVehicleUsers(
    vehicleId: number,
    activeOnly: boolean = true,
  ): Promise<UserResponseDto[]> {
    // Verificar que el vehículo existe
    const vehicle = await this.vehicle.findUnique({
      where: { vehicle_id: vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehículo con ID ${vehicleId} no encontrado`);
    }

    try {
      const userVehicles = await this.user_vehicle.findMany({
        where: {
          vehicle_id: vehicleId,
          ...(activeOnly && { is_active: true }),
        },
        include: {
          user: true,
        },
        orderBy: { assigned_at: 'desc' },
      });

      return userVehicles.map(
        (uv) =>
          new UserResponseDto({
            id: uv.user.id,
            email: uv.user.email,
            name: uv.user.name,
            role: uv.user.role,
            isActive: uv.user.isActive,
            createdAt: formatBATimestampISO(uv.user.createdAt),
            updatedAt: uv.user.updatedAt
              ? formatBATimestampISO(uv.user.updatedAt)
              : undefined,
            profileImageUrl: this.buildProfileImageUrl(uv.user.profileImageUrl),
          }),
      );
    } catch (error) {
      handlePrismaError(error, 'Usuarios del vehículo');
      throw new InternalServerErrorException(
        'Error no manejado al obtener usuarios del vehículo',
      );
    }
  }

  private mapToUserVehicleResponseDto(
    userVehicle: any,
  ): UserVehicleResponseDto {
    return {
      user_vehicle_id: userVehicle.user_vehicle_id,
      user_id: userVehicle.user_id,
      vehicle_id: userVehicle.vehicle_id,
      assigned_at: formatBATimestampISO(userVehicle.assigned_at),
      is_active: userVehicle.is_active,
      notes: userVehicle.notes || undefined,
      vehicle: {
        vehicle_id: userVehicle.vehicle.vehicle_id,
        code: userVehicle.vehicle.code,
        name: userVehicle.vehicle.name,
        description: userVehicle.vehicle.description || undefined,
      },
      user: {
        id: userVehicle.user.id,
        name: userVehicle.user.name,
        email: userVehicle.user.email,
        role: userVehicle.user.role,
      },
    };
  }

  private generateEmailConfirmationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async sendEmailConfirmation(userId: number): Promise<void> {
    try {
      const user = await this.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException('Usuario no encontrado.');
      }

      if (user.isEmailConfirmed) {
        throw new BadRequestException('El email ya está confirmado.');
      }

      const confirmationToken = this.generateEmailConfirmationToken();
      const tokenExpires = new Date();
      tokenExpires.setHours(tokenExpires.getHours() + 24); // Token válido por 24 horas

      await this.user.update({
        where: { id: userId },
        data: {
          emailConfirmationToken: confirmationToken,
          emailTokenExpires: tokenExpires,
        },
      });

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000';
      const confirmationUrl = `${frontendUrl}/confirm-email?token=${confirmationToken}`;

      await this.mailService.sendConfirmationEmail(
        user.email,
        user.name,
        confirmationToken,
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        'Error enviando email de confirmación.',
      );
    }
  }

  async confirmEmail(token: string): Promise<{ message: string }> {
    try {
      const user = await this.user.findUnique({
        where: { emailConfirmationToken: token },
      });

      if (!user) {
        throw new BadRequestException('Token de confirmación inválido.');
      }

      if (user.emailTokenExpires && user.emailTokenExpires < new Date()) {
        throw new BadRequestException('Token de confirmación expirado.');
      }

      if (user.isEmailConfirmed) {
        throw new BadRequestException('El email ya está confirmado.');
      }

      await this.user.update({
        where: { id: user.id },
        data: {
          isEmailConfirmed: true,
          emailConfirmationToken: null,
          emailTokenExpires: null,
        },
      });

      // Enviar email de bienvenida
      await this.mailService.sendWelcomeEmail(user.email, user.name);

      return { message: 'Email confirmado exitosamente.' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Error confirmando email.');
    }
  }
}
