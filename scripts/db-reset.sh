#!/bin/bash
set -euo pipefail

npm run db:backup

docker compose -f docker-compose.yml run --rm backend \
  sh -lc "npx prisma db push --force-reset && npx prisma db seed"

echo "Reset completado y seed ejecutado"
