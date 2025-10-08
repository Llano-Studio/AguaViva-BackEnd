import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from './roles.decorator';
import { UserRolesGuard } from '../guards/roles.guard';
import { Role } from '@prisma/client';

export const Auth = (...roles: Role[]) => {
  return applyDecorators(
    Roles(...roles),
    UseGuards(JwtAuthGuard, UserRolesGuard),
  );
};
