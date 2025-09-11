import { PrismaClient } from '@prisma/client';
import { BUSINESS_CONFIG } from '../src/common/config/business.config';
import * as bcrypt from 'bcrypt';

/**
 * BACKUP AUTOMÁTICO PARA MIGRACIONES EN PRODUCCIÓN
 * 
 * Para implementar backup automático antes de migraciones que requieren reset:
 * 
 * 1. Crear script de backup en package.json:
 *    "backup:db": "pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql"
 * 
 * 2. Modificar scripts de migración:
 *    "migrate:reset:prod": "npm run backup:db && npx prisma migrate reset --force && npm run seed"
 *    "migrate:deploy:prod": "npm run backup:db && npx prisma migrate deploy"
 * 
 * 3. Para restaurar backup si es necesario:
 *    "restore:db": "psql $DATABASE_URL < backup_file.sql"
 * 
 * 4. Variables de entorno requeridas:
 *    DATABASE_URL=postgresql://user:password@host:port/database
 * 
 * IMPORTANTE: Siempre probar en ambiente de desarrollo antes de producción
 */

const prisma = new PrismaClient();

// Función auxiliar para verificar si estamos en producción
const isProduction = () => process.env.NODE_ENV === 'production';

// Función para mostrar advertencia en producción
const showProductionWarning = () => {
  if (isProduction()) {
    console.log('⚠️  ADVERTENCIA: Ejecutando seed en PRODUCCIÓN');
    console.log('⚠️  Asegúrate de haber hecho backup de la base de datos');
    console.log('⚠️  Comando sugerido: npm run backup:db');
    console.log('');
  }
};

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');
  
  // Mostrar advertencia si estamos en producción
  showProductionWarning();

  // 1. Crear tipos de movimiento
  console.log('📋 Creando tipos de movimiento...');
  // Tipos de movimiento según la base de datos
  const movementTypes = [
    // Egresos (Salidas de inventario)
    {
      code: 'EGR_VENTA',
      description: 'Egreso por venta de producto'
    },
    {
      code: 'EGR_V_UNI',
      description: 'Egreso por venta única'
    },
    {
      code: 'EGR_COMOD',
      description: 'Egreso por entrega en comodato'
    },
    {
      code: 'AJ_NEG',
      description: 'Ajuste negativo de inventario'
    },
    {
      code: 'TRANS_SAL',
      description: 'Transferencia de salida'
    },
    // Ingresos (Entradas de inventario)
    {
      code: 'ING_DEV_PC',
      description: 'Ingreso por devolución de pedido cancelado'
    },
    {
      code: 'ING_DEV_CL',
      description: 'Ingreso por devolución de cliente'
    },
    {
      code: 'ING_DV_VU',
      description: 'Ingreso por devolución de venta única'
    },
    {
      code: 'ING_DV_VUC',
      description: 'Ingreso por devolución de venta única cancelada'
    },
    // Tipos adicionales
    {
      code: 'ING_PROD',
      description: 'Ingreso por producción'
    },
    {
      code: 'ING_COMP',
      description: 'Ingreso por compra externa'
    },
    {
      code: 'ING_DV_COM',
      description: 'Ingreso por devolución de comodato'
    },
    {
      code: 'AJ_POS',
      description: 'Ajuste positivo de inventario'
    },
    {
      code: 'TRANS_ENT',
      description: 'Transferencia de entrada'
    },
    {
      code: 'ING_DEV_CS',
      description: 'Ingreso dev. cancelación'
    }
  ];

  for (const movementType of movementTypes) {
    await prisma.movement_type.upsert({
      where: { code: movementType.code },
      update: {},
      create: movementType
    });
    console.log(`  ✅ Tipo de movimiento: ${movementType.code}`);
  }

  // 2. Crear países, provincias y localidades
  console.log('\n🌍 Creando ubicaciones...');
  
  // Países
  const countries = [
    { country_id: 1, code: 'AR', name: 'Argentina' },
    { country_id: 2, code: 'PY', name: 'Paraguay' }
  ];
  
  for (const countryData of countries) {
    await prisma.country.upsert({
      where: { country_id: countryData.country_id },
      update: {},
      create: countryData
    });
  }
  
  // Provincias
  const provinces = [
    // Argentina
    { province_id: 1, country_id: 1, code: 'CH', name: 'Chaco' },
    { province_id: 2, country_id: 1, code: 'CO', name: 'Corrientes' },
    { province_id: 3, country_id: 1, code: 'FO', name: 'Formosa' },
    { province_id: 4, country_id: 1, code: 'MI', name: 'Misiones' },
    { province_id: 5, country_id: 1, code: 'SF', name: 'Santa Fe' },
    // Paraguay
    { province_id: 6, country_id: 2, code: 'DC', name: 'Distrito Capital' }
  ];
  
  for (const provinceData of provinces) {
    await prisma.province.upsert({
      where: { province_id: provinceData.province_id },
      update: {},
      create: provinceData
    });
  }
  
  // Localidades
  const localities = [
    // Chaco
    { province_id: 1, code: 'RES', name: 'Resistencia' },
    { province_id: 1, code: 'PRS_SAENZ', name: 'Presidencia Roque Sáenz Peña' },
    { province_id: 1, code: 'JJC', name: 'Juan José Castelli' },
    { province_id: 1, code: 'VANGELA', name: 'Villa Ángela' },
    { province_id: 1, code: 'CHARATA', name: 'Charata' },
    // Corrientes
    { province_id: 2, code: 'CORRIENTES', name: 'Corrientes' },
    { province_id: 2, code: 'GOYA', name: 'Goya' },
    { province_id: 2, code: 'PAS_LIBRES', name: 'Paso de los Libres' },
    { province_id: 2, code: 'CURUZUCUAT', name: 'Curuzú Cuatiá' },
    { province_id: 2, code: 'MERCEDES', name: 'Mercedes' },
    // Formosa
    { province_id: 3, code: 'FORMOSA', name: 'Formosa' },
    { province_id: 3, code: 'CLORINDA', name: 'Clorinda' },
    { province_id: 3, code: 'PIRANE', name: 'Pirané' },
    // Misiones
    { province_id: 4, code: 'POSADAS', name: 'Posadas' },
    { province_id: 4, code: 'OBERA', name: 'Oberá' },
    { province_id: 4, code: 'ELDORADO', name: 'Eldorado' },
    { province_id: 4, code: 'GARUPA', name: 'Garupá' },
    { province_id: 4, code: 'PT_IGUAZU', name: 'Puerto Iguazú' },
    // Santa Fe
    { province_id: 5, code: 'SANTAFE', name: 'Santa Fe de la Vera Cruz' },
    { province_id: 5, code: 'ROSARIO', name: 'Rosario' },
    { province_id: 5, code: 'RAFAELA', name: 'Rafaela' },
    { province_id: 5, code: 'RECONQUIST', name: 'Reconquista' },
    { province_id: 5, code: 'VILLACONS', name: 'Villa Constitución' },
    // Paraguay - Distrito Capital
    { province_id: 6, code: 'ASUNCION', name: 'Asunción' },
    { province_id: 6, code: 'SANLORENZ', name: 'San Lorenzo' },
    { province_id: 6, code: 'FEDMORA', name: 'Fernando de la Mora' },
    { province_id: 6, code: 'LAMBARA', name: 'Lambaré' },
    { province_id: 6, code: 'LUQUE', name: 'Luque' },
    { province_id: 6, code: 'MROQALON', name: 'Mariano Roque Alonso' }
  ];
  
  for (const localityData of localities) {
    await prisma.locality.upsert({
      where: { code: localityData.code },
      update: {},
      create: localityData
    });
  }

  // 3. Crear zona por defecto en Resistencia
  const resistenciaLocality = await prisma.locality.findUnique({
    where: { code: 'RES' }
  });
  
  if (!resistenciaLocality) {
    throw new Error('No se encontró la localidad de Resistencia');
  }
  
  const zone = await prisma.zone.upsert({
    where: {
      unique_zone_code_per_locality: {
        locality_id: resistenciaLocality.locality_id,
        code: 'CENTRO'
      }
    },
    update: {},
    create: {
      code: 'CENTRO',
      name: 'Centro',
      locality_id: resistenciaLocality.locality_id
    }
  });

  // 4. Crear almacén por defecto
  console.log('\n🏪 Creando almacén por defecto...');
  const warehouse = await prisma.warehouse.upsert({
    where: { warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID },
    update: {},
    create: {
      warehouse_id: BUSINESS_CONFIG.INVENTORY.DEFAULT_WAREHOUSE_ID,
      name: 'Almacén Principal',
      locality_id: resistenciaLocality.locality_id
    }
  });
  console.log(`  ✅ Almacén: ${warehouse.name}`);

  // 5. Crear usuario administrador general
  console.log('\n👤 Creando usuario administrador general...');
  const hashedPassword = await bcrypt.hash('admiN2025.', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: {},
    create: {
      email: 'admin@gmail.com',
      password: hashedPassword,
      role: 'SUPERADMIN',
      name: 'Administrador General',
      isActive: true,
      isEmailConfirmed: true
    }
  });
  console.log(`  ✅ Usuario administrador: ${adminUser.email}`);



  // 6. Crear lista de precios por defecto
  console.log('\n💰 Creando lista de precios por defecto...');
  const defaultPriceList = await prisma.price_list.upsert({
    where: { price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID },
    update: {},
    create: {
      price_list_id: BUSINESS_CONFIG.PRICING.DEFAULT_PRICE_LIST_ID,
      name: BUSINESS_CONFIG.PRICING.STANDARD_PRICE_LIST_NAME,
      description: 'Lista de precios estándar del sistema',
      effective_date: new Date('2024-01-01'),
      is_default: true,
      active: true
    }
  });
  console.log(`  ✅ Lista de precios: ${defaultPriceList.name}`);

  // 7. Crear canales de venta por defecto
  console.log('\n🛒 Creando canales de venta por defecto...');
  const channels = [
    { sale_channel_id: 1, code: 'WEB', description: 'Ventas a través de la página web' },
    { sale_channel_id: 2, code: 'WHATSAPP', description: 'Ventas a través de WhatsApp' }
  ];

  for (const channel of channels) {
    await prisma.sale_channel.upsert({
      where: { sale_channel_id: channel.sale_channel_id },
      update: {},
      create: channel
    });
    console.log(`  ✅ Canal: ${channel.code}`);
  }

  // NOTA: Inventario inicial eliminado del seed
  // El inventario se creará automáticamente cuando se agreguen productos manualmente

  // 8. Resetear secuencias de autoincrement
  console.log('\n🔄 Reseteando secuencias de autoincrement...');
  
  // Resetear secuencia de country
  await prisma.$executeRaw`SELECT setval('country_country_id_seq', (SELECT MAX(country_id) FROM country));`;
  console.log('  ✅ Secuencia de country reseteada');
  
  // Resetear secuencia de province
  await prisma.$executeRaw`SELECT setval('province_province_id_seq', (SELECT MAX(province_id) FROM province));`;
  console.log('  ✅ Secuencia de province reseteada');
  
  // Nota: No reseteamos la secuencia de locality porque ahora usa autoincrement correctamente
  
  // Resetear secuencia de zone
  await prisma.$executeRaw`SELECT setval('zone_zone_id_seq', (SELECT MAX(zone_id) FROM zone));`;
  console.log('  ✅ Secuencia de zone reseteada');
  
  // Resetear secuencia de warehouse
  await prisma.$executeRaw`SELECT setval('warehouse_warehouse_id_seq', (SELECT MAX(warehouse_id) FROM warehouse));`;
  console.log('  ✅ Secuencia de warehouse reseteada');
  
  // Resetear secuencia de price_list
  await prisma.$executeRaw`SELECT setval('price_list_price_list_id_seq', (SELECT MAX(price_list_id) FROM price_list));`;
  console.log('  ✅ Secuencia de price_list reseteada');
  
  // Resetear secuencia de sale_channel
  await prisma.$executeRaw`SELECT setval('sale_channel_sale_channel_id_seq', (SELECT MAX(sale_channel_id) FROM sale_channel));`;
  console.log('  ✅ Secuencia de sale_channel reseteada');

  console.log('\n✅ Seed completado exitosamente!');
  console.log('\n📋 Datos creados:');
  console.log('  - Usuario administrador general (admin@gmail.com)');
  console.log('  - Tipos de movimiento de stock');
  console.log('  - Provincias y localidades de Argentina (con autoincrement correcto)');
  console.log('  - Zona por defecto en Resistencia');
  console.log('  - Almacén principal');
  console.log('  - Lista de precios por defecto');
  console.log('  - Canales de venta (WEB, WHATSAPP)');
  console.log('  - Secuencias de autoincrement reseteadas (excepto localities)');
  console.log('\n📝 NOTA: Categorías, productos e inventario deben crearse manualmente');
  console.log('\n🚀 La aplicación está lista para usar!');
  
  if (isProduction()) {
    console.log('\n💾 RECORDATORIO: Para futuras migraciones en producción:');
    console.log('   1. Ejecutar: npm run backup:db');
    console.log('   2. Luego ejecutar la migración');
    console.log('   3. Si hay problemas: npm run restore:db');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });