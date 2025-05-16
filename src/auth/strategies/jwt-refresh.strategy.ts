import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service'; 
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User as PrismaUser, Role } from '@prisma/client'; 


interface ValidatedUserForStrategy {
  id: number;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date | null;

}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') { 
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService, // Inyectamos AuthService para buscar el usuario
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false, 
      secretOrKey: configService.get<string>('JWT_SECRET') || 'sgarav-secret-key',
      passReqToCallback: true, 
    });
  }

  async validate(req: any, payload: JwtPayload): Promise<{ user: ValidatedUserForStrategy, refreshToken: string }> {
    const refreshToken = req.headers.authorization.split(' ')[1];
  
    const user = await this.authService.getUserById(payload.id);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado.');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo.');
    }

    const validatedUser = {
      ...user,
      createdAt: new Date(user.createdAt),
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : null,
    };

    return { user: validatedUser as ValidatedUserForStrategy, refreshToken };
  }
} 