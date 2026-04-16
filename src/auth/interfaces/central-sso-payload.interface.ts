import { Request } from 'express';
import { Role } from '@prisma/client';

export interface CentralSsoPayload {
  userId: number;
  email: string;
  assignedSystem: string;
  name?: string;
  role?: Role;
  type?: string;
  iat?: number;
  exp?: number;
}

export type SsoRequest = Request & {
  centralUser?: CentralSsoPayload;
};
