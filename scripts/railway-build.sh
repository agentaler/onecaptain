#!/usr/bin/env bash
# Role-branched Railway build. One repo feeds several services; each service
# sets SERVICE_ROLE to pick its behavior (see RAILWAY.md "Services").
set -euo pipefail

case "${SERVICE_ROLE:-web}" in
  landing)
    # Static Node server with zero dependencies — nothing to install.
    echo "landing: no build step"
    ;;
  *)
    pnpm install --frozen-lockfile
    # Bindings' secrets must exist before the build: next.config.ts calls
    # initOpenNextCloudflareForDev(), which loads .dev.vars while compiling.
    bash scripts/railway-dev-vars.sh
    # Compile the production bundle here, at build time. Serving `next dev` to
    # real users ships the turbopack dev runtime (hundreds of unminified
    # chunks + the devtools overlay) and compiles each route on first request.
    pnpm --filter @onecaptain/web exec opennextjs-cloudflare build
    ;;
esac
