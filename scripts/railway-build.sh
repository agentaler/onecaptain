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
    ;;
esac
