#!/usr/bin/env bash
# Role-branched Railway start. SERVICE_ROLE selects the process this service
# runs (see RAILWAY.md "Services").
set -euo pipefail

case "${SERVICE_ROLE:-web}" in
  landing)
    exec node src/landing/server.mjs
    ;;
  *)
    exec bash scripts/railway-phase0.sh
    ;;
esac
