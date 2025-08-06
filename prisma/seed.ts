import { PrismaClient } from '@prisma/client';
import { BUSINESS_CONFIG } from '../src/common/config/business.config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

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
    { locality_id: 1, province_id: 1, code: 'RES', name: 'Resistencia' },
    { locality_id: 2, province_id: 1, code: 'PRS_SAENZ', name: 'Presidencia Roque Sáenz Peña' },
    { locality_id: 3, province_id: 1, code: 'JJC', name: 'Juan José Castelli' },
    { locality_id: 4, province_id: 1, code: 'VANGELA', name: 'Villa Ángela' },
    { locality_id: 5, province_id: 1, code: 'CHARATA', name: 'Charata' },
    // Corrientes
    { locality_id: 6, province_id: 2, code: 'CORRIENTES', name: 'Corrientes' },
    { locality_id: 7, province_id: 2, code: 'GOYA', name: 'Goya' },
    { locality_id: 8, province_id: 2, code: 'PAS_LIBRES', name: 'Paso de los Libres' },
    { locality_id: 9, province_id: 2, code: 'CURUZUCUAT', name: 'Curuzú Cuatiá' },
    { locality_id: 10, province_id: 2, code: 'MERCEDES', name: 'Mercedes' },
    // Formosa
    { locality_id: 11, province_id: 3, code: 'FORMOSA', name: 'Formosa' },
    { locality_id: 12, province_id: 3, code: 'CLORINDA', name: 'Clorinda' },
    { locality_id: 13, province_id: 3, code: 'PIRANE', name: 'Pirané' },
    // Misiones
    { locality_id: 14, province_id: 4, code: 'POSADAS', name: 'Posadas' },
    { locality_id: 15, province_id: 4, code: 'OBERA', name: 'Oberá' },
    { locality_id: 16, province_id: 4, code: 'ELDORADO', name: 'Eldorado' },
    { locality_id: 17, province_id: 4, code: 'GARUPA', name: 'Garupá' },
    { locality_id: 18, province_id: 4, code: 'PT_IGUAZU', name: 'Puerto Iguazú' },
    // Santa Fe
    { locality_id: 19, province_id: 5, code: 'SANTAFE', name: 'Santa Fe de la Vera Cruz' },
    { locality_id: 20, province_id: 5, code: 'ROSARIO', name: 'Rosario' },
    { locality_id: 21, province_id: 5, code: 'RAFAELA', name: 'Rafaela' },
    { locality_id: 22, province_id: 5, code: 'RECONQUIST', name: 'Reconquista' },
    { locality_id: 23, province_id: 5, code: 'VILLACONS', name: 'Villa Constitución' },
    // Paraguay - Distrito Capital
    { locality_id: 24, province_id: 6, code: 'ASUNCION', name: 'Asunción' },
    { locality_id: 25, province_id: 6, code: 'SANLORENZ', name: 'San Lorenzo' },
    { locality_id: 26, province_id: 6, code: 'FEDMORA', name: 'Fernando de la Mora' },
    { locality_id: 27, province_id: 6, code: 'LAMBARA', name: 'Lambaré' },
    { locality_id: 28, province_id: 6, code: 'LUQUE', name: 'Luque' },
    { locality_id: 29, province_id: 6, code: 'MROQALON', name: 'Mariano Roque Alonso' }
  ];
  
  for (const localityData of localities) {
    await prisma.locality.upsert({
      where: { locality_id: localityData.locality_id },
      update: {},
      create: localityData
    });
  }

  // 3. Crear zona por defecto en Resistencia
  const zone = await prisma.zone.upsert({
    where: {
      unique_zone_code_per_locality: {
        locality_id: 1, // Resistencia
        code: 'CENTRO'
      }
    },
    update: {},
    create: {
      code: 'CENTRO',
      name: 'Centro',
      locality_id: 1
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
      locality_id: 1 // Resistencia
    }
  });
  console.log(`  ✅ Almacén: ${warehouse.name}`);

  // 5. Crear categoría de productos por defecto
  console.log('\n📦 Creando categoría de productos por defecto...');
  const category = await prisma.product_category.upsert({
    where: { category_id: 1 },
    update: {},
    create: {
      category_id: 1,
      name: 'Bidones'
    }
  });
  console.log(`  ✅ Categoría: ${category.name}`);

  // 6. Crear productos de ejemplo
  console.log('\n🧴 Creando productos de ejemplo...');
  const products = [
    {
      product_id: 1,
      description: 'Bidón 20L Retornable',
      volume_liters: 20.00,
      price: 1500.00,
      is_returnable: true,
      category_id: category.category_id
    }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { product_id: product.product_id },
      update: {},
      create: product
    });
    console.log(`  ✅ Producto: ${product.description}`);
  }

  // 7. Crear lista de precios por defecto
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

  // 8. Crear canales de venta
  console.log('\n📱 Creando canales de venta...');
  const saleChannels = [
    {
      sale_channel_id: 1,
      code: 'WEB',
      description: 'Whatsapp'
    },
    {
      sale_channel_id: 2,
      code: 'WHATSAPP',
      description: 'Local'
    }
  ];

  for (const saleChannel of saleChannels) {
    await prisma.sale_channel.upsert({
      where: { sale_channel_id: saleChannel.sale_channel_id },
      update: {
        code: saleChannel.code,
        description: saleChannel.description
      },
      create: saleChannel
    });
    console.log(`  ✅ Canal de venta: ${saleChannel.description}`);
  }

  // 9. Crear inventario inicial
  console.log('\n📊 Creando inventario inicial...');
  for (const product of products) {
    await prisma.inventory.upsert({
      where: {
        warehouse_id_product_id: {
          warehouse_id: warehouse.warehouse_id,
          product_id: product.product_id
        }
      },
      update: {},
      create: {
        product_id: product.product_id,
        warehouse_id: warehouse.warehouse_id,
        quantity: 100 // Stock inicial de 100 unidades
      }
    });
    console.log(`  ✅ Stock inicial para ${product.description}: 100 unidades`);
  }

  console.log('\n✅ Seed completado exitosamente!');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });