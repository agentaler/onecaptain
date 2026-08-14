import { describe, it, expect, vi, beforeEach } from "vitest"

const ctxBox: { env: Record<string, string | undefined> } = { env: {} }
const listCredentials = vi.fn()
const primaryWorkspaceId = vi.fn()

vi.mock("@/lib/middleware/auth", () => ({
  withAuth:
    (handler: (req: unknown, ctx: unknown) => unknown) =>
    () =>
      handler({}, { env: ctxBox.env, userId: "u1", email: "u@example" }),
}))
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }))
vi.mock("@/lib/community/primary-workspace", () => ({
  primaryWorkspaceIdForUser: (...a: unknown[]) => primaryWorkspaceId(...a),
}))
vi.mock("@onecaptain/shared", () => ({
  queries: { providerCredential: { listCredentials: (...a: unknown[]) => listCredentials(...a) } },
}))

import { GET } from "./route"

const PLATFORM = { PLATFORM_PROVIDER_KIND: "anthropic", PLATFORM_PROVIDER_API_KEY: "sk-test" }

async function body() {
  return (await (GET as unknown as () => Promise<Response>)()).json()
}

beforeEach(() => {
  vi.clearAllMocks()
  ctxBox.env = {}
  primaryWorkspaceId.mockResolvedValue("w1")
  listCredentials.mockResolvedValue([])
})

describe("GET /api/community/llm-providers", () => {
  it("reports the platform fallback so the UI can tell 'no key of your own' from 'no key at all'", async () => {
    ctxBox.env = { ...PLATFORM }
    expect(await body()).toEqual({ providers: [], platformFallback: true })
  })

  it("reports no fallback when OneCaptain has no key configured", async () => {
    expect(await body()).toEqual({ providers: [], platformFallback: false })
  })

  it("needs BOTH the kind and the key, matching how the provider is resolved", async () => {
    // `resolveAgentProvider` takes its platform branch only when both are set.
    // Reporting a fallback on a half-configured deployment would invite someone
    // to create an agent that then has nothing to run on.
    ctxBox.env = { PLATFORM_PROVIDER_KIND: "anthropic" }
    expect((await body()).platformFallback).toBe(false)
    ctxBox.env = { PLATFORM_PROVIDER_API_KEY: "sk-test" }
    expect((await body()).platformFallback).toBe(false)
  })

  it("still answers for a user with no workspace at all", async () => {
    ctxBox.env = { ...PLATFORM }
    primaryWorkspaceId.mockResolvedValue(null)
    expect(await body()).toEqual({ providers: [], platformFallback: true })
    expect(listCredentials).not.toHaveBeenCalled()
  })

  it("never returns the platform key itself, only that one exists", async () => {
    ctxBox.env = { ...PLATFORM }
    expect(JSON.stringify(await body())).not.toContain("sk-test")
  })

  it("scopes the credential listing to the resolved workspace", async () => {
    listCredentials.mockResolvedValue([{ id: "p1", kind: "openai", last4: "ab12" }])
    const result = await body()
    expect(listCredentials).toHaveBeenCalledWith(expect.anything(), "w1")
    expect(result.providers).toHaveLength(1)
  })
})
