import { Injectable, Logger } from '@nestjs/common';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './decorators/roles.decorator';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';

@Injectable()
export class RolesService {
  private readonly logger = new Logger('RolesService');

  constructor(
    private readonly modulesContainer: ModulesContainer,
    private readonly reflector: Reflector,
  ) {}

  getModulesForRole(role: Role): string[] {
    const modules = new Set<string>();

    try {
      for (const module of this.modulesContainer.values()) {
        const moduleName = module.metatype?.name || 'Unknown Module';

        const controllers = module.controllers as Map<string, InstanceWrapper>;
        for (const controller of controllers.values()) {
          const metatype = controller.metatype;
          
          if (!metatype || typeof metatype !== 'function') {
            this.logger.warn(`Controlador inválido en módulo ${moduleName}`);
            continue;
          }

          const controllerName = metatype.name;
          // Intenta obtener los roles del controlador
          const controllerRoles = this.reflector.get<Role[]>(ROLES_KEY, metatype) || [];
          // Intenta obtener el path del controlador de varias formas
          const path = Reflect.getMetadata('path', metatype) || 
                      this.reflector.get('path', metatype);

          if (path) {
            if (controllerRoles.includes(role)) {
              modules.add(path);
            }
          } else {
            this.logger.warn(`No se encontró path para el controlador ${controllerName}`);
          }
        }
      }

      const result = Array.from(modules);
      this.logger.log(`Módulos finales para rol ${role}: [${result.join(', ')}]`);
      return result;

    } catch (error) {
      this.logger.error('Error al obtener módulos:', error);
      return [];
    }
  }
}
