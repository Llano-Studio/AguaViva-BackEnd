#!/bin/bash
set -e

echo "🚀 Iniciando aplicación..."

NODE_ENV_VALUE="${NODE_ENV:-development}"

echo "⏳ Generando cliente Prisma..."
npx prisma generate

if [ "$NODE_ENV_VALUE" = "production" ]; then
  MIGRATION_MODE="${MIGRATION_MODE:-deploy}"

  if [ "$MIGRATION_MODE" = "deploy" ]; then
    if [ -d prisma/migrations ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
      echo "⏳ Aplicando migraciones (prisma migrate deploy)..."
      npx prisma migrate deploy
    else
      echo "⏭️ No hay migraciones versionadas, saltando migrate deploy"
    fi
  elif [ "$MIGRATION_MODE" = "push" ]; then
    echo "⏳ Sincronizando schema (prisma db push)..."
    npx prisma db push --accept-data-loss=false
  else
    echo "⏭️ MIGRATION_MODE=$MIGRATION_MODE, sin cambios de schema"
  fi

  if [ "${SEED_ON_START:-false}" = "true" ]; then
    echo "🌱 Ejecutando seed..."
    npx prisma db seed
  fi

  echo "🎯 Iniciando aplicación NestJS (prod)..."
  npm run start:prod
else
  echo "⏳ Sincronizando schema (prisma db push)..."
  npx prisma db push --accept-data-loss=false || echo "⚠️ Schema ya sincronizado o requiere revisión manual"

  echo "🌱 Ejecutando seed..."
  npx prisma db seed || true

  echo "🎯 Iniciando aplicación NestJS..."
  npm run start
fi
