import { ConfigService } from '@nestjs/config';
import { MockRouteOptimizer } from './mock-route-optimizer.adapter';
import {
  RouteOptimizer,
  RouteOptimizerProviderName,
} from './route-optimizer.port';

/**
 * Resuelve la implementacion del puerto de optimizacion segun configuracion.
 *
 * Falla al iniciar cuando la configuracion es invalida, en lugar de servir
 * rutas simuladas sin que nadie lo advierta.
 */
export function createRouteOptimizer(
  configService: ConfigService,
): RouteOptimizer {
  const provider = (
    configService.get<string>('app.routeOptimization.provider') || 'mock'
  )
    .toLowerCase()
    .trim() as RouteOptimizerProviderName;

  const environment =
    configService.get<string>('app.app.environment') ||
    process.env.NODE_ENV ||
    'development';

  const allowMockInProduction =
    configService.get<boolean>(
      'app.routeOptimization.allowMockInProduction',
    ) === true;

  switch (provider) {
    case 'mock':
      if (environment === 'production' && !allowMockInProduction) {
        throw new Error(
          'ROUTE_OPTIMIZER_PROVIDER=mock no esta permitido en produccion. ' +
            'Configure un proveedor real (google|osrm) o habilite ' +
            'ROUTE_OPTIMIZER_ALLOW_MOCK_IN_PRODUCTION=true de forma explicita.',
        );
      }
      return new MockRouteOptimizer(configService);

    case 'google':
    case 'osrm':
      throw new Error(
        `El proveedor de ruteo "${provider}" todavia no esta implementado. ` +
          'Use ROUTE_OPTIMIZER_PROVIDER=mock mientras tanto.',
      );

    default:
      throw new Error(
        `ROUTE_OPTIMIZER_PROVIDER desconocido: "${String(provider)}". ` +
          'Valores validos: mock, google, osrm.',
      );
  }
}
