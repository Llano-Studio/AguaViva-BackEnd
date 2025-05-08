import { Role } from '@prisma/client';

export enum PersonType {
  INDIVIDUAL = 'INDIVIDUAL',
  COMPANY = 'COMPANY'
}

export enum OrderType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  ONE_OFF = 'ONE_OFF',
  CONTRACT_DELIVERY = 'CONTRACT_DELIVERY'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID'
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

// Re-exportamos Role para tenerlo todo centralizado
export { Role }; 