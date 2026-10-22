#!/bin/sh
# Vercel runs this instead of `npm run build` (see "vercel-build" in
# package.json); local `npm run build` is unaffected.
#
# Database migrations run on production deploys only: preview deploys of
# other branches would otherwise apply their migrations to the production
# database before they're merged. Migrations go over DIRECT_URL (see
# prisma/schema.prisma) — Neon's pooled connection can't run them.
set -e

prisma generate

if [ "$VERCEL_ENV" = "production" ]; then
  prisma migrate deploy
else
  echo "Skipping prisma migrate deploy (VERCEL_ENV=${VERCEL_ENV:-unset}, not production)"
fi

next build
