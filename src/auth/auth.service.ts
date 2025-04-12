import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { PrismaClient, Role, User } from '@prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { RecoverPasswordDto } from './dto/recover-password.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService extends PrismaClient implements OnModuleInit {

  async onModuleInit() {
    await this.$connect();
  }

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async register(registerUserDto: RegisterUserDto) {
    const { email, password, name } = registerUserDto;

    // Verificar si el usuario ya existe
    const existingUser = await this.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('El usuario ya está registrado');
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear el usuario
    const user = await this.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: Role.USER,
      },
    });

    // Generar JWT
    const token = this.generateJwt(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    // Buscar el usuario
    const user = await this.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Validar la contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Generar JWT
    const token = this.generateJwt(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }

  async checkAuthStatus(user: User) {
    return {
      ...user,
      token: this.generateJwt(user.id),
    };
  }

  private generateJwt(userId: number) {
    const payload: JwtPayload = { id: userId };
    return this.jwtService.sign(payload);
  }

  async getAllUsers() {
    return this.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getUserById(id: number) {
    const user = await this.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    return user;
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.user.findUnique({ where: { id } });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    // Verificar si el email ya existe en otro usuario
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingUser) {
        throw new BadRequestException('El email ya está en uso por otro usuario');
      }
    }

    return this.user.update({
      where: { id },
      data: {
        name: updateUserDto.name,
        email: updateUserDto.email,
        role: updateUserDto.role,
        isActive: updateUserDto.isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
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

    return { message: 'Contraseña actualizada correctamente' };
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

    return { message: 'Se ha enviado un correo con las instrucciones para recuperar la contraseña' };
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

      return { message: 'Contraseña actualizada correctamente' };
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
