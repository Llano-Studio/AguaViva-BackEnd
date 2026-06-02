import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserRolesGuard } from './guards/roles.guard';
import { Role } from '@prisma/client';
import { RolesService } from './roles.service';

class TestJwtAuthGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    req.user = {
      id: 1,
      centralUserId: 10,
      email: 'user@test.com',
      name: 'User',
      role: Role.SUPERADMIN,
      isActive: true,
    };
    return true;
  }
}

class TestUserRolesGuard {
  canActivate() {
    return true;
  }
}

describe('AuthController', () => {
  let app: INestApplication;

  const authService = {
    updateMyProfileImage: jest.fn(),
    getProfile: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: RolesService,
          useValue: {
            getModulesForRole: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(TestJwtAuthGuard)
      .overrideGuard(UserRolesGuard)
      .useClass(TestUserRolesGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('PATCH /auth/profile-image -> 401 sin token', async () => {
    await request(app.getHttpServer()).patch('/auth/profile-image').expect(401);
  });

  it('PATCH /auth/profile-image -> 200 con token', async () => {
    authService.updateMyProfileImage.mockResolvedValueOnce({
      id: 1,
      centralUserId: 10,
      email: 'user@test.com',
      name: 'User',
      role: Role.SUPERADMIN,
      isActive: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      profileImageUrl: 'http://login/public/uploads/profile-images/a.png',
    });

    await request(app.getHttpServer())
      .patch('/auth/profile-image')
      .set('Authorization', 'Bearer token')
      .attach('profileImage', Buffer.from('file'), {
        filename: 'profile.png',
        contentType: 'image/png',
      })
      .expect(200);

    expect(authService.updateMyProfileImage).toHaveBeenCalled();
  });
});
