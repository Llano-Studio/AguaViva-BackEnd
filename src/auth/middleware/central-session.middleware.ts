import { NextFunction, Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

type CentralJwtPayload = {
  userId: number;
  email: string;
  assignedSystem: string;
  name?: string;
  role?: Role;
  type?: string;
  iat?: number;
  exp?: number;
};

type RequestWithCentralUser = Request & {
  centralUser?: CentralJwtPayload;
};

const prisma = new PrismaClient();

export const verifyCentralSession = async (
  req: RequestWithCentralUser,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ message: 'Token requerido' });
    return;
  }

  const jwtSecret =
    process.env.LOGIN_SERVICE_JWT_SECRET ||
    process.env.CENTRAL_AUTH_JWT_SECRET ||
    process.env.JWT_SECRET;
  if (!jwtSecret) {
    res
      .status(500)
      .json({ message: 'LOGIN_SERVICE_JWT_SECRET no configurado' });
    return;
  }

  const requiredSystem =
    process.env.CENTRAL_AUTH_SYSTEM_CODE ||
    process.env.MODULE_SYSTEM_CODE ||
    'AGUAVIVA';
  const centralAuthIssuer = process.env.CENTRAL_AUTH_ISSUER || 'login-service';

  try {
    const payload = jwt.verify(token, jwtSecret, {
      issuer: centralAuthIssuer,
      audience: requiredSystem,
    }) as CentralJwtPayload;
    if (!payload.userId || !payload.email || !payload.assignedSystem) {
      res.status(401).json({ message: 'Token inválido' });
      return;
    }
    if (payload.type !== 'access') {
      res.status(401).json({ message: 'Token de sesión inválido' });
      return;
    }
    if (payload.assignedSystem !== requiredSystem) {
      res
        .status(403)
        .json({ message: `Usuario sin acceso al sistema ${requiredSystem}` });
      return;
    }

    const normalizedEmail = payload.email.toLowerCase().trim();
    const resolvedName = payload.name?.trim() || normalizedEmail;
    const resolvedRole = payload.role ?? Role.ADMINISTRATIVE;

    const existingByCentralId = await prisma.user.findUnique({
      where: { centralUserId: payload.userId },
      select: {
        id: true,
        centralUserId: true,
        email: true,
        name: true,
        role: true,
      },
    });
    const existingByEmail = existingByCentralId
      ? null
      : await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            centralUserId: true,
            email: true,
            name: true,
            role: true,
          },
        });
    const existingUser = existingByCentralId ?? existingByEmail;

    if (!existingUser) {
      await prisma.user.create({
        data: {
          centralUserId: payload.userId,
          email: normalizedEmail,
          password: null,
          name: resolvedName,
          role: resolvedRole,
          isActive: true,
          isEmailConfirmed: true,
        },
      });
    } else if (
      existingUser.centralUserId !== payload.userId ||
      existingUser.email !== normalizedEmail ||
      existingUser.name !== resolvedName ||
      existingUser.role !== resolvedRole
    ) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          centralUserId: payload.userId,
          email: normalizedEmail,
          name: resolvedName,
          role: resolvedRole,
          isActive: true,
          isEmailConfirmed: true,
        },
      });
    }

    req.centralUser = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
};
