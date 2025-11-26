import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';

@Injectable()
export class RolesService {
  private readonly logger = new Logger('RolesService');

  /**
   * Obtiene los módulos permitidos para un rol específico
   * @param role Rol del usuario
   * @returns Array de módulos permitidos
   */
  getModulesForRole(role: Role): string[] {
    const modulesByRole: Record<Role, string[]> = {
      [Role.SUPERADMIN]: [
        'inventory',
        'persons',
        'orders',
        'manual-collection',
        'first-cycle-comodato',
        'overdue-orders',
        'zones',
        'countries',
        'provinces',
        'localities',
        'vehicles',
        'vehicle-inventories',
        'comodatos',
        'priceLists',
        'products',
        'suscriptionPlans',
        'users',
      ],
      [Role.BOSSADMINISTRATIVE]: [
        'inventory',
        'persons',
        'orders',
        'manual-collection',
        'first-cycle-comodato',
        'overdue-orders',
        'zones',
        'countries',
        'provinces',
        'localities',
        'vehicles',
        'vehicle-inventories',
        'comodatos',
        'priceLists',
        'products',
        'suscriptionPlans',
      ],
      [Role.ADMINISTRATIVE]: [
        'inventory',
        'persons',
        'orders',
        'manual-collection',
        'first-cycle-comodato',
        'overdue-orders',
        'zones',
        'countries',
        'provinces',
        'localities',
        'vehicles',
        'vehicle-inventories',
        'comodatos',
        'priceLists',
        'products',
        'suscriptionPlans',
      ],
      [Role.DRIVERS]: [],
    };

    const modules = modulesByRole[role] || [];

    this.logger.log(`Módulos para rol ${role}: [${modules.join(', ')}]`);

    return modules;
  }
}
