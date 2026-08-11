import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { ClientPortalPayload } from '../guards/client-portal-jwt.guard';

export const GetClientPortal = createParamDecorator(
  (data: keyof ClientPortalPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const payload: ClientPortalPayload | undefined = request.clientPortal;
    if (!payload) {
      throw new InternalServerErrorException(
        'No se encontró el cliente autenticado en la solicitud',
      );
    }
    if (data) {
      return payload[data];
    }
    return payload;
  },
);
