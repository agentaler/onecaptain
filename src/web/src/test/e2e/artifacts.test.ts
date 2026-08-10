import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { seedTestData, cleanupTestData, type TestSeed, tokenRequest } from "@onecaptain/test-utils"

let seed: TestSeed
let conversationId: string
let artifactId: string

beforeAll(async () => {
  seed = seedTestData()

  const convRes = await tokenRequest(
    `/api/conversations?workspace_id=${seed.workspaceId}`,
    seed.machineToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: seed.agentId }),
    },
  )
  const convData = await convRes.json() as { id: string }
  conversationId = convData.id
})

afterAll(() => cleanupTestData(seed))

describe("POST /api/artifacts/upload", () => {
  it("uploads a file and returns artifact metadata", async () => {
    const fileContent = new Blob(["hello world"], { type: "text/plain" })
    const formData = new FormData()
    formData.append("file", new File([fileContent], "test.txt", { type: "text/plain" }))
    formData.append("conversation_id", conversationId)

    const res = await tokenRequest(
      `/api/artifacts/upload?workspace_id=${seed.workspaceId}`,
      seed.machineToken,
      {
        method: "POST",
        body: formData,
      },
    )
    expect(res.status).toBe(200)
    const data = await res.json() as Record<string, unknown>
    expect(data.id).toBeTruthy()
    expect(data.filename).toBe("test.txt")
    expect(data.content_type).toBe("text/plain")
    expect(data.size).toBe(11)
    expect(data.conversation_id).toBe(conversationId)
    artifactId = data.id as string
  })

  it("rejects upload without file", async () => {
    const formData = new FormData()
    formData.append("conversation_id", conversationId)

    const res = await tokenRequest(
      `/api/artifacts/upload?workspace_id=${seed.workspaceId}`,
      seed.machineToken,
      {
        method: "POST",
        body: formData,
      },
    )
    expect(res.status).toBe(400)
  })

  it("rejects upload without conversation_id", async () => {
    const fileContent = new Blob(["data"], { type: "text/plain" })
    const formData = new FormData()
    formData.append("file", new File([fileContent], "test2.txt", { type: "text/plain" }))

    const res = await tokenRequest(
      `/api/artifacts/upload?workspace_id=${seed.workspaceId}`,
      seed.machineToken,
      {
        method: "POST",
        body: formData,
      },
    )
    expect(res.status).toBe(400)
  })

  it("rejects upload for non-existent conversation", async () => {
    const fileContent = new Blob(["data"], { type: "text/plain" })
    const formData = new FormData()
    formData.append("file", new File([fileContent], "test3.txt", { type: "text/plain" }))
    formData.append("conversation_id", "conv_nonexistent_xyz")

    const res = await tokenRequest(
      `/api/artifacts/upload?workspace_id=${seed.workspaceId}`,
      seed.machineToken,
      {
        method: "POST",
        body: formData,
      },
    )
    expect(res.status).toBe(404)
  })
})

describe("GET /api/artifacts", () => {
  it("lists artifacts for a conversation", async () => {
    const res = await tokenRequest(
      `/api/artifacts?workspace_id=${seed.workspaceId}&conversation_id=${conversationId}`,
      seed.machineToken,
    )
    expect(res.status).toBe(200)
    const data = await res.json() as Array<Record<string, unknown>>
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(1)
    expect(data.some(a => a.id === artifactId)).toBe(true)
  })

  it("returns 400 without conversation_id", async () => {
    const res = await tokenRequest(
      `/api/artifacts?workspace_id=${seed.workspaceId}`,
      seed.machineToken,
    )
    expect(res.status).toBe(400)
  })

  it("rejects unauthenticated request", async () => {
    const res = await fetch(
      `${process.env.APP_URL || "http://localhost:3000"}/api/artifacts?workspace_id=${seed.workspaceId}&conversation_id=${conversationId}`,
    )
    expect(res.status).toBe(401)
  })
})
