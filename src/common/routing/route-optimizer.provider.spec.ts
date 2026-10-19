import { ConfigService } from '@nestjs/config';
import { MockRouteOptimizer } from './mock-route-optimizer.adapter';
import { createRouteOptimizer } from './route-optimizer.provider';

describe('createRouteOptimizer', () => {
  const buildConfig = (values: Record<string, unknown>): ConfigService =>
    ({
      get: (key: string) => values[key],
    }) as unknown as ConfigService;

  it('devuelve el mock cuando el proveedor es mock', () => {
    const optimizer = createRouteOptimizer(
      buildConfig({
        'app.routeOptimization.provider': 'mock',
        'app.app.environment': 'development',
      }),
    );

    expect(optimizer).toBeInstanceOf(MockRouteOptimizer);
    expect(optimizer.provider).toBe('mock');
    expect(optimizer.is_simulated).toBe(true);
  });

  it('no permite el mock en producción sin habilitación explícita', () => {
    expect(() =>
      createRouteOptimizer(
        buildConfig({
          'app.routeOptimization.provider': 'mock',
          'app.app.environment': 'production',
          'app.routeOptimization.allowMockInProduction': false,
        }),
      ),
    ).toThrow(/no esta permitido en produccion/);
  });

  it('permite el mock en producción con habilitación explícita', () => {
    const optimizer = createRouteOptimizer(
      buildConfig({
        'app.routeOptimization.provider': 'mock',
        'app.app.environment': 'production',
        'app.routeOptimization.allowMockInProduction': true,
      }),
    );

    expect(optimizer).toBeInstanceOf(MockRouteOptimizer);
  });

  it('falla cuando el proveedor todavía no está implementado', () => {
    expect(() =>
      createRouteOptimizer(
        buildConfig({
          'app.routeOptimization.provider': 'google',
          'app.app.environment': 'development',
        }),
      ),
    ).toThrow(/todavia no esta implementado/);
  });

  it('falla cuando el proveedor es desconocido', () => {
    expect(() =>
      createRouteOptimizer(
        buildConfig({
          'app.routeOptimization.provider': 'otro',
          'app.app.environment': 'development',
        }),
      ),
    ).toThrow(/desconocido/);
  });
});
