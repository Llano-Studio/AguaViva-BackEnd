#!/bin/bash
set -e

echo "🚀 Iniciando aplicación..."

echo "⏳ Generando cliente Prisma..."
npx prisma generate

echo "⏳ Sincronizando schema (sin pérdida de datos)..."
npx prisma db push --accept-data-loss=false || echo "⚠️ Schema ya sincronizado o requiere revisión manual"

echo "🌱 Ejecutando seed..."
# corre el script declarado en package.json -> prisma.seed
npx prisma db seed || true

echo "🎯 Iniciando aplicación NestJS..."
npm run start:prod
