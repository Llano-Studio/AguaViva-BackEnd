import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import * as jwt from 'jsonwebtoken';
import { join } from 'path';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createTestPrisma } from '../helpers/test-db';

/**
 * Regresión por HTTP de las APIs PREEXISTENTES (las que NO son del módulo de
 * choferes). Su objetivo es comprobar que la fase de choferes y sus migraciones
 * no rompieron los contratos existentes.
 *
 * Se pone foco en la superficie del decorador compartido `@FormDataBody`
 * (src/common/decorators/form-data-body.decorator.ts), que fue modificado en
 * esta rama, y en un smoke de lecturas administrativas.
 *
 * La validación es por contrato HTTP (código de estado y cuerpo), no por
 * llamadas directas a los servicios.
 */

const API = '/api';

type RoleName =
  | 'DRIVERS'
  | 'ADMINISTRATIVE'
  | 'SUPERADMIN'
  | 'BOSSADMINISTRATIVE';

/** Valida que un endpoint de lectura devuelva un listado (array o { data: [] }). */
const expectListLike = (body: any) => {
  if (Array.isArray(body)) {
    return;
  }
  expect(body).toBeDefined();
  expect(Array.isArray(body.data)).toBe(true);
};

describe('Regresión de APIs preexistentes (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaClient;

  let superToken: string;
  let driverToken: string;
  let superUser: { id: number; email: string };
  let driverUser: { id: number; email: string };
  let category: { category_id: number };

  /** Directorio donde el generador de PDF escribe los archivos. */
  const pdfDir = join(process.cwd(), 'public', 'pdfs');
  /** Archivos presentes en `public/pdfs` antes de las pruebas. */
  let pdfFilesBefore: string[] = [];

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signToken = (user: { id: number; email: string; role: RoleName }) =>
    jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '1h' },
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // Replica el bootstrap de main.ts necesario para el contrato HTTP.
    app.setGlobalPrefix('api', { exclude: ['/', 'health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
        forbidNonWhitelisted: false,
      }),
    );
    await app.init();

    // Detiene los cron jobs para que no escriban durante las pruebas.
    const registry = app.get(SchedulerRegistry, { strict: false });
    registry.getCronJobs().forEach((job) => job.stop());

    server = app.getHttpServer();
    prisma = createTestPrisma();

    pdfFilesBefore = existsSync(pdfDir) ? readdirSync(pdfDir) : [];
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();

    // Borra únicamente los PDFs generados por estas pruebas.
    if (existsSync(pdfDir)) {
      readdirSync(pdfDir)
        .filter((file) => !pdfFilesBefore.includes(file))
        .forEach((file) => {
          try {
            unlinkSync(join(pdfDir, file));
          } catch {
            /* archivo ya eliminado por el propio controlador */
          }
        });
    }
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE ' +
        '"route_reconciliation", "driver_account_movement", "route_sheet_pause", ' +
        '"inventory_transaction", "vehicle_route_inventory", "delivery_evidence", ' +
        '"delivery_incident", "payment_transaction", "payment_proof", ' +
        '"route_sheet_detail", "route_sheet", "order_item", "order_header", ' +
        '"product", "product_category", "person", "vehicle", "sale_channel", ' +
        '"payment_method", "User" ' +
        'RESTART IDENTITY CASCADE',
    );

    // Usuario SUPERADMIN con contraseña hasheada: sirve tanto para el login real
    // como para firmar el token administrativo del resto de las pruebas.
    const superRow = await prisma.user.create({
      data: {
        email: 'super@test.local',
        name: 'Super Test',
        role: 'SUPERADMIN',
        password: await bcrypt.hash('Password123', 10),
        isActive: true,
      },
    });
    superUser = { id: superRow.id, email: superRow.email };
    superToken = signToken({
      id: superRow.id,
      email: superRow.email,
      role: superRow.role as RoleName,
    });

    // Usuario de rol DRIVERS para verificar el guard de roles.
    const driverRow = await prisma.user.create({
      data: { email: 'chofer@test.local', name: 'Chofer Test', role: 'DRIVERS' },
    });
    driverUser = { id: driverRow.id, email: driverRow.email };
    driverToken = signToken({
      id: driverRow.id,
      email: driverRow.email,
      role: driverRow.role as RoleName,
    });

    category = await prisma.product_category.create({
      data: { name: 'Categoría Regresión' },
    });
  });

  // ---------------------------------------------------------------------------
  // 1) LOGIN REAL
  // ---------------------------------------------------------------------------
  it('1) POST /api/auth/login con credenciales válidas devuelve tokens', async () => {
    // DISCREPANCIA con la doc Swagger (que anuncia 200): el handler `login`
    // no declara @HttpCode, por lo que Nest responde 201 (default de POST).
    // Se ajusta la aserción al contrato REAL de la aplicación.
    const response = await request(server)
      .post(`${API}/auth/login`)
      .send({ email: 'super@test.local', password: 'Password123' })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe('super@test.local');
    expect(response.body.user.role).toBe('SUPERADMIN');
  });

  it('2) POST /api/auth/login con contraseña incorrecta responde 401', async () => {
    const response = await request(server)
      .post(`${API}/auth/login`)
      .send({ email: 'super@test.local', password: 'Password999' })
      .expect(401);

    expect(response.body.message).toContain('Credenciales');
  });

  it('3) POST /api/auth/login con email inexistente responde 401', async () => {
    await request(server)
      .post(`${API}/auth/login`)
      .send({ email: 'nadie@test.local', password: 'Password123' })
      .expect(401);
  });

  it('4) POST /api/auth/login con body inválido responde 400 (validación del DTO)', async () => {
    await request(server)
      .post(`${API}/auth/login`)
      .send({ email: 'no-es-un-email' })
      .expect(400);
  });

  // ---------------------------------------------------------------------------
  // 2) HEALTH (excluido del prefijo global api)
  // ---------------------------------------------------------------------------
  it('5) GET /health responde 200', async () => {
    const response = await request(server).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.database).toBe('boolean');
  });

  // ---------------------------------------------------------------------------
  // 3) SUPERFICIE DEL DECORADOR MULTIPART COMPARTIDO (@FormDataBody)
  // ---------------------------------------------------------------------------
  it('6) POST /api/auth/register (multipart) hace llegar los campos válidos al DTO y descarta los desconocidos', async () => {
    // `role` en minúsculas verifica el @Transform del DTO (toUpperCase).
    // `campoDesconocido` no está en la lista blanca del decorador y debe descartarse.
    const response = await request(server)
      .post(`${API}/auth/register`)
      .field('email', 'nuevo@test.local')
      .field('password', 'Password123')
      .field('name', 'Nuevo Usuario')
      .field('role', 'administrative')
      .field('campoDesconocido', 'no-deberia-llegar')
      .expect(201);

    expect(response.body.user.email).toBe('nuevo@test.local');
    expect(response.body.user.name).toBe('Nuevo Usuario');
    expect(response.body.user.role).toBe('ADMINISTRATIVE');
    expect(response.body.accessToken).toEqual(expect.any(String));
    // El campo desconocido no forma parte del DTO ni de la respuesta.
    expect((response.body.user as any).campoDesconocido).toBeUndefined();

    const stored = await prisma.user.findUnique({
      where: { email: 'nuevo@test.local' },
    });
    expect(stored).not.toBeNull();
    // La contraseña se hashea (no se guarda en claro).
    expect(stored?.password).not.toBe('Password123');
  });

  it('7) POST /api/auth/register (multipart) sin un campo requerido responde 400 (no 500)', async () => {
    // Falta `name`, que es requerido por RegisterUserDto.
    const response = await request(server)
      .post(`${API}/auth/register`)
      .field('email', 'sin-nombre@test.local')
      .field('password', 'Password123')
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('8) POST /api/auth/register (multipart) con email ya registrado responde 409', async () => {
    await request(server)
      .post(`${API}/auth/register`)
      .field('email', 'super@test.local')
      .field('password', 'Password123')
      .field('name', 'Duplicado')
      .expect(409);
  });

  it('9) POST /api/products (multipart, SUPERADMIN) crea el producto, convierte booleanos y descarta campos desconocidos', async () => {
    // `is_returnable` viaja como string ("false") y el DTO lo convierte a boolean.
    // `campoDesconocido` no está en la lista blanca del decorador.
    const response = await request(server)
      .post(`${API}/products`)
      .set(authHeader(superToken))
      .field('category_id', String(category.category_id))
      .field('description', 'Bidón regresión 20L')
      .field('price', '1200')
      .field('is_returnable', 'false')
      .field('campoDesconocido', 'no-deberia-llegar')
      .expect(201);

    expect(response.body.product_id).toBeGreaterThan(0);
    expect(response.body.description).toBe('Bidón regresión 20L');
    expect(response.body.is_returnable).toBe(false);
    expect(response.body.price).toBe(1200);
    expect((response.body as any).campoDesconocido).toBeUndefined();

    const stored = await prisma.product.findUnique({
      where: { product_id: response.body.product_id },
    });
    expect(stored?.description).toBe('Bidón regresión 20L');
    expect(stored?.is_returnable).toBe(false);
  });

  it('10) POST /api/products (multipart) sin un campo requerido responde 400 (no 500)', async () => {
    // Falta `description`, requerido por CreateProductDto.
    const response = await request(server)
      .post(`${API}/products`)
      .set(authHeader(superToken))
      .field('category_id', String(category.category_id))
      .field('price', '1200')
      .field('is_returnable', 'true')
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('11) POST /api/products (multipart) sin token responde 401', async () => {
    await request(server)
      .post(`${API}/products`)
      .field('category_id', String(category.category_id))
      .field('description', 'Producto sin token')
      .field('price', '100')
      .field('is_returnable', 'true')
      .expect(401);
  });

  it('12) PUT /api/auth/users/:id (multipart, SUPERADMIN) con un campo inválido responde 400 (no 500)', async () => {
    // UpdateUserDto valida `role` contra el enum: un valor inválido da 400.
    const response = await request(server)
      .put(`${API}/auth/users/${driverUser.id}`)
      .set(authHeader(superToken))
      .field('role', 'NO_ES_UN_ROL')
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('13) PUT /api/auth/users/:id (multipart) con datos válidos sobre un usuario local responde 400 (contrato real: exige usuario centralizado)', async () => {
    // DISCREPANCIA con el contrato documentado ("actualiza a cualquier usuario"):
    // el servicio solo actualiza usuarios centralizados en login-service
    // (centralUserId !== null). Un usuario local sembrado directo en la base
    // devuelve 400 con este mensaje. Se ajusta la aserción al contrato REAL.
    const response = await request(server)
      .put(`${API}/auth/users/${driverUser.id}`)
      .set(authHeader(superToken))
      .field('name', 'Nombre Actualizado')
      .expect(400);

    expect(response.body.message).toContain('login-service');
  });

  // ---------------------------------------------------------------------------
  // 4) SMOKE DE LECTURAS ADMINISTRATIVAS
  // ---------------------------------------------------------------------------
  const adminReads: Array<[string, (body: any) => void]> = [
    ['/persons', expectListLike],
    ['/products', expectListLike],
    ['/categories', expectListLike],
    ['/zones', expectListLike],
    ['/vehicles', expectListLike],
    ['/auth/users', expectListLike],
    ['/route-sheets', expectListLike],
    ['/price-list', expectListLike],
    ['/comodatos/get-all-comodatos', expectListLike],
    ['/customer-subscriptions', expectListLike],
    ['/cycle-payments/pending', expectListLike],
    ['/subscription-plans', expectListLike],
    ['/inventory/stock/full', expectListLike],
  ];

  it.each(adminReads)(
    '14) smoke: GET %s responde 200 con un listado válido',
    async (path, validate) => {
      const response = await request(server)
        .get(`${API}${path}`)
        .set(authHeader(superToken))
        .expect(200);

      validate(response.body);
    },
  );

  it('15) smoke: GET /api/persons sin token responde 401', async () => {
    await request(server).get(`${API}/persons`).expect(401);
  });

  it('16) smoke: GET /api/persons con token de rol DRIVERS responde 403', async () => {
    // Persons exige ADMINISTRATIVE/SUPERADMIN/BOSSADMINISTRATIVE.
    await request(server)
      .get(`${API}/persons`)
      .set(authHeader(driverToken))
      .expect(403);
  });

  // ---------------------------------------------------------------------------
  // 5) PDF (generador con pdfkit, sin servicios externos)
  // ---------------------------------------------------------------------------
  it('17) GET /api/dev/pdf/preview-route responde 200 con un PDF', async () => {
    const response = await request(server)
      .get(`${API}/dev/pdf/preview-route`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk as Buffer));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(response.headers['content-type']).toContain('application/pdf');
    expect((response.body as Buffer).length).toBeGreaterThan(0);
    // El archivo en disco lo borra el propio controlador a los 5s; el afterAll
    // limpia cualquier resto que quede de estas pruebas.
  });
});
