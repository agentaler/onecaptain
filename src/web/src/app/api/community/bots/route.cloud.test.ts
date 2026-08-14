import { describe, it, expect, vi, beforeEach } from "vitest"

// Creating an agent used to be impossible without a machine: the schema
// required `machineId`, the handler 404'd without one, and the form refused to
// submit. An agent runs on an LLM key now, so a machine is neither required nor
// sufficient — these assert the cloud path exists AND that the machine path was
// only made conditional, not deleted.

const ctxBox: { env: Record<string, unknown> } = { env: {} }
const createBot = vi.fn()
const getMachineForOwner = vi.fn()
const primaryWorkspaceId = vi.fn()
const pushBotEventToMachine = vi.fn()

vi.mock("@/lib/middleware/auth", () => ({
  withAuth:
    (handler: (req: unknown, ctx: unknown) => unknown) =>
    (req: unknown) =>
      handler(req, { env: ctxBox.env, userId: "u1", email: "u@example" }),
}))
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }))
vi.mock("@/lib/community/bot-push", () => ({
  pushBotEventToMachine: (...a: unknown[]) => pushBotEventToMachine(...a),
}))
vi.mock("@/lib/community/audit", () => ({
  logAudit: vi.fn(),
  COMMUNITY_AUDIT_ACTIONS: new Proxy({}, { get: (_t, k) => String(k) }),
}))
vi.mock("@/lib/community/primary-workspace", () => ({
  primaryWorkspaceIdForUser: (...a: unknown[]) => primaryWorkspaceId(...a),
}))
vi.mock("@onecaptain/shared", async () => {
  const actual = await vi.importActual<typeof import("@onecaptain/shared")>("@onecaptain/shared")
  return {
    ...actual,
    queries: {
      communityBot: {
        countLiveBotsForOwner: async () => 0,
        getMachineForOwner: (...a: unknown[]) => getMachineForOwner(...a),
        createBot: (...a: unknown[]) => createBot(...a),
        listBotsForOwner: async () => [],
        getBotDailyActivityForOwner: async () => new Map(),
      },
      user: { getUserPublic: async () => ({ name: "Gus", discriminator: "0001" }) },
      communityFriendship: { ensureSiblingBotFriendship: async () => ({ blocked: false }) },
    },
  }
})

import { POST } from "./route"

function post(body: unknown) {
  return (POST as unknown as (r: Request) => Promise<Response>)(
    new Request("https://app.example/api/community/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  ctxBox.env = {}
  primaryWorkspaceId.mockResolvedValue("w1")
  createBot.mockResolvedValue({
    botId: "b1",
    name: "Ada",
    discriminator: "0007",
    description: "",
    image: null,
  })
})

describe("POST /api/community/bots — no machine required", () => {
  it("creates a cloud agent from a name alone", async () => {
    const res = await post({ name: "Ada" })
    expect(res.status).toBeLessThan(300)
    expect(getMachineForOwner).not.toHaveBeenCalled()
    expect(createBot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ machineId: null, runtime: "cloud" }),
    )
  })

  it("binds the cloud agent to a workspace, so it can resolve a key", async () => {
    // Without a workspace there is no credential to resolve and no ledger to
    // meter against — the agent would exist but never be able to run.
    await post({ name: "Ada" })
    expect(createBot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ workspaceId: "w1" }),
    )
  })

  it("refuses a cloud agent when the caller has no workspace", async () => {
    primaryWorkspaceId.mockResolvedValue(null)
    expect((await post({ name: "Ada" })).status).toBe(409)
    expect(createBot).not.toHaveBeenCalled()
  })

  it("does not push to a daemon that does not exist", async () => {
    await post({ name: "Ada" })
    expect(pushBotEventToMachine).not.toHaveBeenCalled()
  })

  it("still validates a machine when one is named", async () => {
    // The machine path is conditional, not removed — a daemon-backed agent must
    // keep getting the same ownership and health checks.
    getMachineForOwner.mockResolvedValue(null)
    expect((await post({ name: "Ada", machineId: "m1", runtime: "claude" })).status).toBe(404)
    expect(createBot).not.toHaveBeenCalled()
  })

  it("still rejects an unhealthy runtime on a named machine", async () => {
    getMachineForOwner.mockResolvedValue({
      id: "m1",
      availableRuntimes: [{ id: "claude", status: "unhealthy" }],
    })
    expect((await post({ name: "Ada", machineId: "m1", runtime: "claude" })).status).toBe(400)
    expect(createBot).not.toHaveBeenCalled()
  })

  it("creates and pushes for a healthy named machine", async () => {
    getMachineForOwner.mockResolvedValue({
      id: "m1",
      availableRuntimes: [{ id: "claude", status: "healthy" }],
    })
    const res = await post({ name: "Ada", machineId: "m1", runtime: "claude" })
    expect(res.status).toBeLessThan(300)
    expect(createBot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ machineId: "m1", runtime: "claude" }),
    )
    expect(pushBotEventToMachine).toHaveBeenCalled()
  })
})
