import { BadRequestException, Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { PrismaClient, Role, User } from '@prisma/client';

@Injectable()
export class AuthService extends PrismaClient implements OnModuleInit {

  async onModuleInit() {
    await this.$connect();
  }

  constructor(
    private readonly jwtService: JwtService,
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
}
