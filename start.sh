#!/bin/bash

echo "🚀 Iniciando aplicación..."

# Esperar a que la base de datos esté disponible
echo "⏳ Esperando conexión a la base de datos..."
npx prisma db push

# Verificar si ya hay datos en la base de datos
echo "🔍 Verificando si la base de datos necesita seed..."
TABLES_COUNT=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tail -n 1)

if [ "$TABLES_COUNT" = "0" ] || [ "$TABLES_COUNT" = "" ]; then
    echo "🌱 Ejecutando seed inicial..."
    npx prisma db seed
else
    echo "📊 Base de datos ya contiene datos, omitiendo seed"
fi

echo "🎯 Iniciando aplicación NestJS..."
npm run start:prod
