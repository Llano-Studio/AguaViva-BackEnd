import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException, InternalServerErrorException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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

  private buildProfileImageUrl(profileImageUrl: string | null): string | undefined {
    return buildImageUrl(profileImageUrl, 'profile-images') || undefined;
  }

  private generateJwtToken(payload: JwtPayload, expiresIn: string | number): string {
    return this.jwtService.sign(payload, { expiresIn });
  }

  private async generateAndStoreRefreshToken(userId: number): Promise<string> {
    const refreshTokenExpiresIn = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION_TIME') || '7d';
    const refreshTokenPayload: JwtPayload = { id: userId };
    const refreshToken = this.generateJwtToken(refreshTokenPayload, refreshTokenExpiresIn);

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
      throw new InternalServerErrorException('Error al guardar el token de refresco.');
    }
    return refreshToken;
  }

  async register(registerUserDto: RegisterUserDto, profileImage?: any) {
    const { email, password, name, isActive, role } = registerUserDto;
    try {
      const existingUser = await this.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException(`El ${this.entityName.toLowerCase()} con email '${email}' ya está registrado.`);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userData: Prisma.UserCreateInput = {
        email,
        password: hashedPassword,
        name,
        role: role || Role.ADMIN,
        isActive: isActive === undefined ? true : isActive,
      };

      if (profileImage?.filename) {
        userData.profileImageUrl = profileImage.filename;
      }

      const user = await this.user.create({ data: userData });

      const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') || '4h';
      const accessToken = this.generateJwtToken({ id: user.id }, accessTokenExpiresIn);
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
          profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl)
        }),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(`Error registrando ${this.entityName.toLowerCase()}.`);
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

      const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') || '4h';
      const accessToken = this.generateJwtToken({ id: user.id }, accessTokenExpiresIn);
      const refreshToken = await this.generateAndStoreRefreshToken(user.id);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl)
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
      const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') || '4h';
      const accessToken = this.generateJwtToken({ id: user.id }, accessTokenExpiresIn);
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
      throw new InternalServerErrorException('Error al verificar el estado de autenticación.');
    }
  }

  async getAllUsers(filters?: FilterUsersDto) {
    try {
      const whereClause: Prisma.UserWhereInput = {};
      if (filters) {
        if (filters.search) {
          whereClause.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } }
          ];
        }
        if (filters.role) whereClause.role = filters.role;
        if (filters.isActive !== undefined) whereClause.isActive = filters.isActive;
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;

      const totalUsers = await this.user.count({ where: whereClause });
      const orderByClause = parseSortByString(filters?.sortBy, [{ name: 'asc' }]);

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
        orderBy: orderByClause
      });

      const userDtos = users.map(user => new UserResponseDto({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : undefined,
        profileImageUrl: this.buildProfileImageUrl(user.profileImageUrl),
      }));

      return {
        data: userDtos,
        meta: {
          total: totalUsers,
          page: page,
          limit: limit,
          totalPages: Math.ceil(totalUsers / limit)
        }
      };
    } catch (error) {
      handlePrismaError(error, `${this.entityName}s`);
      throw new InternalServerErrorException(`Error obteniendo ${this.entityName.toLowerCase()}s.`);
    }
  }

  async getUserById(id: number) {
    try {
      const user = await this.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          profileImageUrl: true,
        }
      });

      if (!user) {
        throw new NotFoundException(`${this.entityName} con ID ${id} no encontrado.`);
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
      throw new InternalServerErrorException(`Error obteniendo ${this.entityName.toLowerCase()} con ID ${id}.`);
    }
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto, profileImage?: any) {
    const { email, name, role, isActive } = updateUserDto;
    try {
      const userToUpdate = await this.user.findUnique({ where: { id } });
      if (!userToUpdate) {
        throw new NotFoundException(`${this.entityName} con ID ${id} no encontrado.`);
      }

      if (email && email !== userToUpdate.email) {
        const existingUser = await this.user.findUnique({ where: { email } });
        if (existingUser) {
          throw new ConflictException(`El email '${email}' ya está en uso por otro ${this.entityName.toLowerCase()}.`);
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
        updatedAt: updatedUser.updatedAt ? updatedUser.updatedAt.toISOString() : undefined,
        profileImageUrl: this.buildProfileImageUrl(updatedUser.profileImageUrl),
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(`Error actualizando ${this.entityName.toLowerCase()} con ID ${id}.`);
    }
  }

  async deleteUser(id: number) {
    try {
      const userToDelete = await this.user.findUnique({ where: { id } });
      if (!userToDelete) {
        throw new NotFoundException(`${this.entityName} con ID ${id} no encontrado.`);
      }
      await this.user.delete({ where: { id } });
      return { message: `${this.entityName} con ID ${id} eliminado.` };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(`Error eliminando ${this.entityName.toLowerCase()} con ID ${id}.`);
    }
  }

  async updatePassword(userId: number, updatePasswordDto: UpdatePasswordDto) {
    const { currentPassword, newPassword } = updatePasswordDto;
    try {
      const user = await this.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(`${this.entityName} no encontrado.`);
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
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
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error actualizando la contraseña.');
    }
  }

  async recoverPassword(recoverPasswordDto: RecoverPasswordDto) {
    const { email } = recoverPasswordDto;
    try {
      const user = await this.user.findUnique({ where: { email } });
      if (!user) {
        throw new NotFoundException(`${this.entityName} con email '${email}' no encontrado.`);
      }

      const recoveryToken = (await bcrypt.hash(Math.random().toString(36).substring(2, 15), 10)).replace(/\//g, '');
      const recoveryTokenExpires = new Date(Date.now() + 3600000); // 1 hora

      await this.user.update({
        where: { email },
        data: { recoveryToken, recoveryTokenExpires, updatedAt: new Date() },
      });

      await this.mailService.sendPasswordRecoveryEmail(user.email, recoveryToken);
      return { message: 'Si el email está registrado, recibirás un correo para recuperar tu contraseña.' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error durante la recuperación de contraseña.');
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

      return { message: 'Contraseña restablecida correctamente.' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException('Error restableciendo la contraseña.');
    }
  }

  async createUser(createUserDto: CreateUserDto, profileImage?: any) {
    const { email, password, name, role, isActive } = createUserDto;
    try {
      const existingUser = await this.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException(`El ${this.entityName.toLowerCase()} con email '${email}' ya existe.`);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const userData: Prisma.UserCreateInput = {
        email,
        password: hashedPassword,
        name,
        role: role || Role.USER,
        isActive: isActive === undefined ? true : isActive,
      };
      if (profileImage?.filename) {
        userData.profileImageUrl = profileImage.filename;
      }

      const newUser = await this.user.create({ data: userData });

      return new UserResponseDto({
        ...newUser,
        createdAt: newUser.createdAt.toISOString(),
        updatedAt: newUser.updatedAt ? newUser.updatedAt.toISOString() : undefined,
        profileImageUrl: this.buildProfileImageUrl(newUser.profileImageUrl),
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) throw error;
      handlePrismaError(error, this.entityName);
      throw new InternalServerErrorException(`Error creando ${this.entityName.toLowerCase()}.`);
    }
  }

  async validateAndParseRefreshToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_REFRESH_TOKEN_SECRET'),
      });
      return payload;
    } catch (err) {
      return null;
    }
  }

  async handleRefreshToken(oldRefreshTokenString: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const storedRefreshToken = await this.refreshToken.findUnique({
        where: { token: oldRefreshTokenString },
        include: { user: true },
      });

      if (!storedRefreshToken || storedRefreshToken.expiresAt < new Date()) {
        if (storedRefreshToken) {
          await this.refreshToken.delete({ where: { id: storedRefreshToken.id } });
        }
        throw new UnauthorizedException('Token de refresco inválido o expirado.');
      }

      const user = storedRefreshToken.user;
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario inactivo o no encontrado.');
      }

      const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') || '4h';
      const newAccessToken = this.generateJwtToken({ id: user.id }, accessTokenExpiresIn);
      const newRefreshToken = await this.generateAndStoreRefreshToken(user.id);
      await this.refreshToken.delete({ where: { id: storedRefreshToken.id } });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      handlePrismaError(error, 'Token de refresco');
      throw new InternalServerErrorException('Error al procesar el token de refresco.');
    }
  }
}

