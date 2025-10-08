import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
  applyDecorators,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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
import { handlePrismaError } from '../common/utils/prisma-error-handler.utils';
import { buildImageUrl } from '../common/utils/file-upload.util';

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
    const refreshToken = this.generateJwtToken(
      refreshTokenPayload,
      refreshTokenExpiresIn,
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
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt?.toISOString(),
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
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt
              ? user.updatedAt.toISOString()
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
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : undefined,
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
    profileImage?: any,
  ) {
    const { email, name, role, isActive } = updateUserDto;
    try {
      const userToUpdate = await this.user.findUnique({ where: { id } });
      if (!userToUpdate) {
        throw new NotFoundException(
          `${this.entityName} con ID ${id} no encontrado.`,
        );
      }

      if (email && email !== userToUpdate.email) {
        const existingUser = await this.user.findUnique({ where: { email } });
        if (existingUser) {
          throw new ConflictException(
            `El email '${email}' ya está en uso por otro ${this.entityName.toLowerCase()}.`,
          );
        }
      }

      const dataToUpdate: Prisma.UserUpdateInput = {};
      if (email) dataToUpdate.email = email;
      if (name) dataToUpdate.name = name;
      if (role) dataToUpdate.role = role;
      if (isActive !== undefined) dataToUpdate.isActive = isActive;
      if (profileImage?.filename) {
        dataToUpdate.profileImageUrl = profileImage.filename;
      }
      dataToUpdate.updatedAt = new Date();

      const updatedUser = await this.user.update({
        where: { id },
        data: dataToUpdate,
      });

      return new UserResponseDto({
        ...updatedUser,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt
          ? updatedUser.updatedAt.toISOString()
          : undefined,
        profileImageUrl: this.buildProfileImageUrl(updatedUser.profileImageUrl),
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
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
      // Soft delete: cambiar isActive a false en lugar de eliminar físicamente
      await this.user.update({
        where: { id },
        data: { isActive: false },
      });
      return { message: `${this.entityName} con ID ${id} desactivado.` };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        `Error desactivando ${this.entityName.toLowerCase()} con ID ${id}.`,
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
      if (!user) {
        throw new NotFoundException(
          `${this.entityName} con email '${email}' no encontrado.`,
        );
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

      if (!user) {
        throw new BadRequestException('Token inválido o expirado.');
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

  async createUser(createUserDto: CreateUserDto, profileImage?: any) {
    const { email, password, name, role, isActive } = createUserDto;
    try {
      const existingUser = await this.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException(
          `El ${this.entityName.toLowerCase()} con email '${email}' ya existe.`,
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

      const newUser = await this.user.create({ data: userData });

      return new UserResponseDto({
        ...newUser,
        createdAt: newUser.createdAt.toISOString(),
        updatedAt: newUser.updatedAt
          ? newUser.updatedAt.toISOString()
          : undefined,
        profileImageUrl: this.buildProfileImageUrl(newUser.profileImageUrl),
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      )
        throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(
        `Error creando ${this.entityName.toLowerCase()}.`,
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
  ): Promise<UserVehicleResponseDto[]> {
    // Verificar que el usuario existe
    await this.getUserById(userId);

    // Verificar que todos los vehículos existen
    const vehicles = await this.vehicle.findMany({
      where: { vehicle_id: { in: dto.vehicleIds } },
    });

    if (vehicles.length !== dto.vehicleIds.length) {
      const foundIds = vehicles.map((v) => v.vehicle_id);
      const missingIds = dto.vehicleIds.filter((id) => !foundIds.includes(id));
      throw new BadRequestException(
        `Los siguientes vehículos no existen: ${missingIds.join(', ')}`,
      );
    }

    try {
      return await this.$transaction(async (prisma) => {
        // 🆕 LÓGICA ADITIVA: No desactivar asignaciones previas, solo agregar nuevas

        // Crear nuevas asignaciones solo para vehículos no asignados
        const assignments = await Promise.all(
          dto.vehicleIds.map(async (vehicleId) => {
            // Verificar si ya existe la relación activa
            const existingAssignment = await prisma.user_vehicle.findFirst({
              where: {
                user_id: userId,
                vehicle_id: vehicleId,
                is_active: true,
              },
            });

            if (existingAssignment) {
              // 🆕 Si ya existe y está activa, NO actualizar fecha de asignación
              // Solo actualizar notas si se proporcionan nuevas
              if (dto.notes && dto.notes !== existingAssignment.notes) {
                return await prisma.user_vehicle.update({
                  where: {
                    user_vehicle_id: existingAssignment.user_vehicle_id,
                  },
                  data: {
                    notes: dto.notes,
                    // NO actualizar assigned_at para mantener la fecha original
                  },
                  include: {
                    vehicle: true,
                    user: true,
                  },
                });
              } else {
                // Devolver la asignación existente sin cambios
                return await prisma.user_vehicle.findFirst({
                  where: {
                    user_vehicle_id: existingAssignment.user_vehicle_id,
                  },
                  include: {
                    vehicle: true,
                    user: true,
                  },
                });
              }
            } else {
              // Verificar si existe una asignación inactiva para reactivarla
              const inactiveAssignment = await prisma.user_vehicle.findFirst({
                where: {
                  user_id: userId,
                  vehicle_id: vehicleId,
                  is_active: false,
                },
              });

              if (inactiveAssignment) {
                // Reactivar asignación existente
                return await prisma.user_vehicle.update({
                  where: {
                    user_vehicle_id: inactiveAssignment.user_vehicle_id,
                  },
                  data: {
                    is_active: true,
                    notes: dto.notes,
                    assigned_at: new Date(), // Solo actualizar fecha al reactivar
                  },
                  include: {
                    vehicle: true,
                    user: true,
                  },
                });
              } else {
                // Crear nueva asignación
                return await prisma.user_vehicle.create({
                  data: {
                    user_id: userId,
                    vehicle_id: vehicleId,
                    is_active: dto.isActive ?? true,
                    notes: dto.notes,
                  },
                  include: {
                    vehicle: true,
                    user: true,
                  },
                });
              }
            }
          }),
        );

        return assignments.map(this.mapToUserVehicleResponseDto);
      });
    } catch (error) {
      handlePrismaError(error, 'Asignación de vehículos');
      throw new InternalServerErrorException(
        'Error no manejado al asignar vehículos al usuario',
      );
    }
  }

  async getUserVehicles(
    userId: number,
    activeOnly: boolean = true,
  ): Promise<UserVehicleResponseDto[]> {
    await this.getUserById(userId);

    try {
      const userVehicles = await this.user_vehicle.findMany({
        where: {
          user_id: userId,
          ...(activeOnly && { is_active: true }),
        },
        include: {
          vehicle: true,
          user: true,
        },
        orderBy: { assigned_at: 'desc' },
      });

      return userVehicles.map(this.mapToUserVehicleResponseDto);
    } catch (error) {
      handlePrismaError(error, 'Vehículos del usuario');
      throw new InternalServerErrorException(
        'Error no manejado al obtener vehículos del usuario',
      );
    }
  }

  async removeVehicleFromUser(
    userId: number,
    vehicleId: number,
  ): Promise<{ message: string; removed: boolean }> {
    await this.getUserById(userId);

    const existingAssignment = await this.user_vehicle.findFirst({
      where: { user_id: userId, vehicle_id: vehicleId, is_active: true },
    });

    if (!existingAssignment) {
      throw new NotFoundException(
        `No existe una asignación activa entre el usuario ${userId} y el vehículo ${vehicleId}`,
      );
    }

    try {
      await this.user_vehicle.update({
        where: { user_vehicle_id: existingAssignment.user_vehicle_id },
        data: { is_active: false },
      });

      return {
        message: 'Vehículo removido del usuario correctamente',
        removed: true,
      };
    } catch (error) {
      handlePrismaError(error, 'Remoción de vehículo');
      throw new InternalServerErrorException(
        'Error no manejado al remover vehículo del usuario',
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
            createdAt: uv.user.createdAt.toISOString(),
            updatedAt: uv.user.updatedAt?.toISOString(),
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
      assigned_at: userVehicle.assigned_at.toISOString(),
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
