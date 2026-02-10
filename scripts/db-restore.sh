#!/bin/bash
set -euo pipefail

SQL_FILE="${1:-}"
if [ -z "${SQL_FILE}" ]; then
  echo "Uso: npm run db:restore -- <ruta/al/backup.sql>"
  exit 1
fi

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
  psql -U "${DBU}" -d "${DBN}" \
  < "${SQL_FILE}"

echo "Restauración ejecutada desde ${SQL_FILE}"
