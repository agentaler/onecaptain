#!/usr/bin/env bash
# Write the .dev.vars files that workerd reads for its bindings' secrets.
# Both the build (`opennextjs-cloudflare build` loads them through
# initOpenNextCloudflareForDev) and the runtime (`wrangler dev`) read these,
# so the same generator runs in both phases.
#
# The app decides prod-vs-dev auth behavior from NODE_ENV *in the worker's own
# env*, not the host process env — so this defaults it to production. Set
# NODE_ENV=development on the service to get the dev sign-in form back.
set -euo pipefail

PUBLIC_URL="${BETTER_AUTH_URL:-https://${RAILWAY_PUBLIC_DOMAIN:-localhost:3000}}"

cat > src/web/.dev.vars <<EOF
NODE_ENV=${NODE_ENV:-production}
AUTH_DEFAULT_METHOD=${AUTH_DEFAULT_METHOD:-password}
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-}
BETTER_AUTH_URL=${PUBLIC_URL}
DEVICE_CLIENT_IDS=${DEVICE_CLIENT_IDS:-onecaptain-cli}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
EOF

cat > src/email-worker/.dev.vars <<EOF
ENCRYPTION_KEY=${ENCRYPTION_KEY:-}
EOF
