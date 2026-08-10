import { defineConfig, mergeConfig } from "vitest/config"
import { resolve } from "path"
import shared from "../../../vitest.shared"

const dir = resolve(import.meta.dirname)
const root = resolve(dir, "../../../")

// No `@onecaptain/daemon` alias: daemon internals (`WsControlChannel`,
// `startCredentialProxy`/`CredentialBroker`, `createProxyServerApi`) have no
// package-level barrel export for this — test files import them via plain
// relative paths straight into `src/daemon/src/**`, same as the package's own
// unit tests do.
export default mergeConfig(shared, defineConfig({
  resolve: {
    alias: {
      "@onecaptain/shared/community-cli-contract": resolve(root, "src/shared/src/community-cli-contract.ts"),
      "@onecaptain/test-utils": resolve(root, "tests/utils/src/index.ts"),
      "@onecaptain/shared": resolve(root, "src/shared/src/index.ts"),
    },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: [`${dir}/**/*.test.ts`],
    setupFiles: [`${dir}/setup.ts`],
    fileParallelism: false,
  },
}))
