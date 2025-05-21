import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
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

@Injectable()
export class AuthService extends PrismaClient implements OnModuleInit {

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

    await this.refreshToken.create({
      data: {
        token: refreshToken,
        userId: userId,
        expiresAt: expiresAt,
      },
    });

    return refreshToken;
  }

  async register(registerUserDto: RegisterUserDto, profileImage?: any) {
    const { email, password, name } = registerUserDto;

    const existingUser = await this.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new BadRequestException('El usuario ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData: Prisma.UserCreateInput = {
      email,
      password: hashedPassword,
      name,
      role: Role.USER, 
    };

    if (profileImage?.filename) { 
      userData.profileImageUrl = profileImage.filename; 
    }

    const user = await this.user.create({ data: userData });

    const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') || '4h';
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

    const accessToken = this.generateJwtToken(
      { id: user.id },
      accessTokenExpiresIn
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
        profileImageUrl: user.profileImageUrl ? `${appUrl}/public/uploads/profile-images/${user.profileImageUrl}` : undefined
      }),
      accessToken,
      refreshToken,
    };
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas (usuario)');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas (contraseña)');
    }

    const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') || '4h';
    const accessToken = this.generateJwtToken({ id: user.id }, accessTokenExpiresIn);
    const refreshToken = await this.generateAndStoreRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      accessToken,
      refreshToken,
    };
  }

  async checkAuthStatus(user: User) {

    const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') || '4h';
    const accessToken = this.generateJwtToken(
      { id: user.id },
      accessTokenExpiresIn
    );
    const refreshToken = await this.generateAndStoreRefreshToken(user.id);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      accessToken,
      refreshToken,
    };
  }

  async getAllUsers(filters?: FilterUsersDto) {
    try {
      const whereClause: Prisma.UserWhereInput = {};

      if (filters) {
        if (filters.search) {
          whereClause.OR = [
            {
              name:
              {
                contains: filters.search,
                mode: 'insensitive'
              }
            },
            {
              email: {
                contains: filters.search,
                mode: 'insensitive'
              }
            }
          ];
        }

        if (filters.role) {
          whereClause.role = filters.role;
        }

        if (filters.isActive !== undefined) {
          whereClause.isActive = filters.isActive;
        }
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;

      const totalUsers = await this.user.count({
        where: whereClause
      });

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
          // notes: true, 
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' }
      });

      const appUrl = this.configService.get<string>('APP_URL') || ''; 

      const userDtos = users.map(user => new UserResponseDto({
        ...user,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : undefined,
        profileImageUrl: user.profileImageUrl ? `${appUrl}/public/uploads/profile-images/${user.profileImageUrl}` : undefined, 
        // notes: user.notes === null ? undefined : user.notes, 
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
      console.error('Error al obtener usuarios:', error);
      throw new InternalServerErrorException('Error al obtener la lista de usuarios');
    }
  }

  async getUserById(id: number) {
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
        // notes: true, 
      },
    });

    if (!user) {
      throw new BadRequestException(`Usuario con ID ${id} no encontrado.`);
    }

    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000'; 

    return new UserResponseDto({
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt ? user.updatedAt.toISOString() : undefined,
      profileImageUrl: user.profileImageUrl ? `${appUrl}/public/uploads/profile-images/${user.profileImageUrl}` : undefined, 
      // notes: user.notes === null ? undefined : user.notes, 
    });
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto, profileImage?: any) {
    const { name, email, role, isActive } = updateUserDto;

    const user = await this.user.findUnique({ where: { id } });
    if (!user) {
      throw new BadRequestException(`Usuario con ID ${id} no encontrado.`);
    }

    if (email && email !== user.email) {
      const existingUserWithEmail = await this.user.findUnique({ where: { email } });
      if (existingUserWithEmail && existingUserWithEmail.id !== id) {
        throw new BadRequestException('El correo electrónico ya está en uso por otro usuario.');
      }
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};
    if (name) dataToUpdate.name = name;
    if (email) dataToUpdate.email = email;
    if (role) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;

    if (profileImage?.filename) {
      dataToUpdate.profileImageUrl = profileImage.filename;
    }

    try {
      const updatedUser = await this.user.update({
        where: { id },
        data: dataToUpdate,
      });
      const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
      return new UserResponseDto({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt?.toISOString(),
        profileImageUrl: updatedUser.profileImageUrl ? `${appUrl}/public/uploads/profile-images/${updatedUser.profileImageUrl}` : undefined,
      });
    } catch (error) {
      console.error('Error updating user:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Error al actualizar usuario: El correo electrónico ya está en uso por otro usuario.');
      }
      throw new InternalServerErrorException('Error al actualizar el usuario.');
    }
  }

  async deleteUser(id: number) {
    const user = await this.user.findUnique({ where: { id } });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    await this.user.delete({ where: { id } });
    return { message: 'Usuario eliminado correctamente' };
  }

  async updatePassword(userId: number, updatePasswordDto: UpdatePasswordDto) {
    const user = await this.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const isPasswordValid = await bcrypt.compare(updatePasswordDto.currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const hashedPassword = await bcrypt.hash(updatePasswordDto.newPassword, 10);

    await this.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return {
      success: true, 
      message: 'Contraseña actualizada correctamente' };
  }

  async recoverPassword(recoverPasswordDto: RecoverPasswordDto) {
    const user = await this.user.findUnique({
      where: { email: recoverPasswordDto.email },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Generar token de recuperación
    const recoveryToken = this.jwtService.sign(
      { id: user.id },
      { expiresIn: '1h' },
    );

    // Guardar token en la base de datos
    await this.user.update({
      where: { id: user.id },
      data: { recoveryToken },
    });

    // Enviar correo
    await this.mailService.sendPasswordRecoveryEmail(user.email, recoveryToken);

    return { 
      success: true,
      message: 'Se ha enviado un correo con las instrucciones para recuperar la contraseña' };
  }

  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.user.findUnique({
        where: { id: payload.id, recoveryToken: token },
      });

      if (!user) {
        throw new UnauthorizedException('Token inválido o expirado');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await this.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          recoveryToken: null,
        },
      });

      return { 
        success: true,
        message: 'Contraseña actualizada correctamente' 
      };
      
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  async createUser(createUserDto: CreateUserDto, profileImage?: any) {
    const { email, password, name, role, isActive, notes } = createUserDto;

    const existingUser = await this.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('El correo electrónico ya está en uso.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userData: Prisma.UserCreateInput = {
      email,
      password: hashedPassword,
      name,
      role,
      isActive,
    };
    if (createUserDto.notes) {
    }

    if (profileImage?.filename) {
      userData.profileImageUrl = profileImage.filename;
    }

    try {
      const user = await this.user.create({ data: userData });
      const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';
      return new UserResponseDto({ 
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt?.toISOString(),
        profileImageUrl: user.profileImageUrl ? `${appUrl}/public/uploads/profile-images/${user.profileImageUrl}` : undefined,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') { 
          throw new BadRequestException('Error al crear usuario: El correo electrónico ya existe.');
        }
      }
      console.error('Error creating user:', error); 
      throw new InternalServerErrorException('Error al crear el usuario.');
    }
  }

  async validateAndParseRefreshToken(token: string): Promise<JwtPayload | null> {
    try {
 
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch (error) {
      return null;
    }
  }

  async handleRefreshToken(oldRefreshTokenString: string): Promise<{ accessToken: string; refreshToken: string }> {

    const refreshTokenPayload = await this.validateAndParseRefreshToken(oldRefreshTokenString);
    if (!refreshTokenPayload || !refreshTokenPayload.id) {
      throw new UnauthorizedException('Refresh token inválido o expirado.');
    }

    const userId = refreshTokenPayload.id;

    const storedRefreshToken = await this.refreshToken.findUnique({
      where: { 
        token: oldRefreshTokenString 
      },
    });

    if (!storedRefreshToken) {
      throw new UnauthorizedException('Refresh token no encontrado en la base de datos o ya invalidado.');
    }

    if (storedRefreshToken.userId !== userId) {
      throw new UnauthorizedException('Refresh token no pertenece al usuario.');
    }

    if (new Date(storedRefreshToken.expiresAt) < new Date()) {
      await this.refreshToken.delete({ where: { id: storedRefreshToken.id } });
      throw new UnauthorizedException('Refresh token expirado (según base de datos).');
    }

    await this.refreshToken.delete({ where: { id: storedRefreshToken.id } });

    // 4. Generar un nuevo access_token
    const accessTokenExpiresIn = this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') || '4h';
    const newAccessToken = this.generateJwtToken({ id: userId }, accessTokenExpiresIn);

    // 5. Generar y guardar un nuevo refresh_token
    const newRefreshToken = await this.generateAndStoreRefreshToken(userId);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}

