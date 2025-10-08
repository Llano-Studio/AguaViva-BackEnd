#!/bin/bash
set -e

echo "🚀 Iniciando aplicación..."

echo "⏳ Aplicando migraciones..."
npx prisma migrate deploy

echo "🌱 Ejecutando seed..."
# corre el script declarado en package.json -> prisma.seed
npx prisma db seed || true

echo "🎯 Iniciando aplicación NestJS..."
npm run start:prod
