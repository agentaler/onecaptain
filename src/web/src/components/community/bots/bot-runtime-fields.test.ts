import { describe, it, expect } from "vitest"
import { normalizeRuntimes } from "./bot-runtime-fields"
import type { CommunityMachineSummary } from "@onecaptain/shared"

// Moved here with the function. Creating a bot no longer picks a machine or a
// runtime, but EDITING a machine-bound agent still lists its runtimes, so this
// normalization is live code and keeps its coverage.

function machine(over: Partial<CommunityMachineSummary>): CommunityMachineSummary {
  return {
    id: "m1",
    hostname: "host",
    displayName: "",
    platform: "darwin",
    arch: "arm64",
    osRelease: "",
    daemonVersion: "0",
    lastSeenAt: null,
    status: "online",
    availableRuntimes: [],
    createdAt: "",
    updatedAt: "",
    ...over,
  }
}

describe("normalizeRuntimes", () => {
  it("returns [] when availableRuntimes is missing", () => {
    expect(normalizeRuntimes(undefined)).toEqual([])
    // legacy summary missing the field entirely
    const legacy = { ...machine({}) } as CommunityMachineSummary
    delete (legacy as { availableRuntimes?: unknown }).availableRuntimes
    expect(normalizeRuntimes(legacy)).toEqual([])
  })

  it("normalizes bare-string legacy entries to healthy", () => {
    const m = machine({
      availableRuntimes: ["claude"] as unknown as CommunityMachineSummary["availableRuntimes"],
    })
    expect(normalizeRuntimes(m)).toEqual([{ id: "claude", unhealthy: false }])
  })

  it("marks status:'unhealthy' entries unhealthy and sorts healthy-first", () => {
    const m = machine({
      availableRuntimes: [
        { id: "sick", status: "unhealthy" },
        { id: "ok", status: "healthy" },
      ] as unknown as CommunityMachineSummary["availableRuntimes"],
    })
    expect(normalizeRuntimes(m)).toEqual([
      { id: "ok", unhealthy: false },
      { id: "sick", unhealthy: true },
    ])
  })
})
