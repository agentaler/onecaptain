#!/usr/bin/env bash
# Phase 0 Railway boot — run the CI-proven dev-parity stack in one container.
# See RAILWAY.md "Phase status": this is the interim runtime until the Phase 1
# Node port lands. All wrangler state (D1 + R2 + DO storage) lives under
# src/web/.wrangler by default — symlinking that onto the /data volume makes
# every default path persistent without touching any dev script.
set -euo pipefail

: "${BETTER_AUTH_SECRET:?BETTER_AUTH_SECRET is required}"
: "${ENCRYPTION_KEY:?ENCRYPTION_KEY is required}"

# Public URL: explicit BETTER_AUTH_URL wins; otherwise the Railway domain.
PUBLIC_URL="${BETTER_AUTH_URL:-https://${RAILWAY_PUBLIC_DOMAIN:-localhost:3000}}"

# Persist all wrangler state on the volume.
if [ -d /data ]; then
  mkdir -p /data/wrangler-root
  rm -rf src/web/.wrangler
  ln -sfn /data/wrangler-root src/web/.wrangler
fi

cat > src/web/.dev.vars <<EOF
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=${PUBLIC_URL}
DEVICE_CLIENT_IDS=${DEVICE_CLIENT_IDS:-onecaptain-cli}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
EOF
cat > src/email-worker/.dev.vars <<EOF
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF

export BETTER_AUTH_URL="$PUBLIC_URL"
export BETTER_AUTH_SECRET ENCRYPTION_KEY
# Keep wrangler quiet — Railway drops logs above 500 lines/sec, hiding real
# signal behind dev-server debug spew.
export WRANGLER_LOG=warn

pnpm run db:migrate

pnpm --filter @onecaptain/email-worker dev &
pnpm --filter @onecaptain/ws-do dev &
pnpm --filter @onecaptain/wake-worker dev &

# Web on 3000 (the Railway service's PORT variable is set to 3000). If the
# web process dies the container exits and Railway restarts everything.
exec pnpm --filter @onecaptain/web exec next dev -H 0.0.0.0 -p 3000
