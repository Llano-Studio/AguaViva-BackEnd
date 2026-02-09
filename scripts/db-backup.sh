#!/bin/bash
set -euo pipefail

TS="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="./backups/${TS}"
mkdir -p "${OUT_DIR}"

DBU="${POSTGRES_USER:-postgres}"
DBP="${POSTGRES_PASSWORD:-123456}"
DBN="${POSTGRES_DB:-sgarav_db}"
if [ -f ".env" ]; then
  tmp="$(grep -E '^DB_USER=' .env | tail -n1 | cut -d'=' -f2- || true)"; [ -n "${tmp}" ] && DBU="${tmp}"
  tmp="$(grep -E '^DB_PASSWORD=' .env | tail -n1 | cut -d'=' -f2- || true)"; [ -n "${tmp}" ] && DBP="${tmp}"
  tmp="$(grep -E '^DB_NAME=' .env | tail -n1 | cut -d'=' -f2- || true)"; [ -n "${tmp}" ] && DBN="${tmp}"
fi

docker compose -f docker-compose.yml exec -T postgres \
  env PGPASSWORD="${DBP}" \
  pg_dump -U "${DBU}" -d "${DBN}" \
  > "${OUT_DIR}/backup.sql" || {
    echo "Intento de backup con credenciales de .env falló, probando credenciales por defecto"
    docker compose -f docker-compose.yml exec -T postgres \
      env PGPASSWORD="123456" \
      pg_dump -U "postgres" -d "${DBN}" \
      > "${OUT_DIR}/backup.sql"
  }

echo "Backup creado en ${OUT_DIR}/backup.sql"
