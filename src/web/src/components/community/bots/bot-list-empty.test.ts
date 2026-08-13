import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"
import TestRenderer, { act } from "react-test-renderer"

// The empty state decides whether someone may create an agent at all. Its
// inputs are the workspace's own keys AND whether OneCaptain has one that would
// serve them — a free workspace with no key of its own still runs on ours, so a
// gate that only looked at `providers` would block exactly the users the free
// tier exists for.

const providersMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/hooks/community/use-machines", () => ({
  useMachines: () => ({ machines: [], isLoading: false }),
}))
vi.mock("@/hooks/community/use-llm-providers", () => ({
  useLlmProviders: () => providersMock(),
}))
vi.mock("@/hooks/community/use-bots", () => ({
  useBots: () => ({ bots: [], isLoading: false }),
  useDeleteBot: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetBotSession: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetMachineAgents: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock("@/hooks/community/mutations", () => ({
  useCreateOrGetDm: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock("@/stores/community/ws", () => ({
  useOnlineUserIds: () => new Set<string>(),
}))

function passthrough(name: string) {
  return function P({ children }: { children?: React.ReactNode }) {
    return React.createElement("div", { "data-mock": name }, children)
  }
}
vi.mock("./create-bot-sheet", () => ({ CreateBotSheet: passthrough("create-sheet") }))
vi.mock("./edit-bot-sheet", () => ({ EditBotSheet: passthrough("edit-sheet") }))
vi.mock("./bot-activity-modal", () => ({ BotActivityModal: passthrough("activity-modal") }))
vi.mock("@/components/avatar", () => ({
  AgentAvatar: () => React.createElement("span", {}),
  GeneratedAvatar: () => React.createElement("span", {}),
}))
vi.mock("@/components/provider-logo", () => ({ ProviderLogo: () => React.createElement("span", {}) }))
vi.mock("@/components/community/onboarding-tiles/create-tile", () => ({
  CreateTile: () => React.createElement("span", {}),
}))
vi.mock("@/components/community/onboarding-tiles/agent-help-gallery", () => ({
  AgentHelpGallery: passthrough("help"),
}))

import { BotList } from "./bot-list"

const KEY = {
  id: "p1",
  kind: "anthropic",
  apiUrl: null,
  last4: "ab12",
  createdAt: "",
  updatedAt: "",
}

function renderText(): string {
  let renderer!: TestRenderer.ReactTestRenderer
  act(() => {
    renderer = TestRenderer.create(React.createElement(BotList, {}))
  })
  return JSON.stringify(renderer.toJSON())
}

describe("BotList empty state — who may create an agent", () => {
  beforeEach(() => providersMock.mockReset())

  it("lets a keyless workspace create a bot when OneCaptain's key serves it", () => {
    // The free tier. Blocking here would be the bug.
    providersMock.mockReturnValue({ providers: [], platformFallback: true, isLoading: false })
    const text = renderText()
    expect(text).toContain("No bots yet")
    expect(text).not.toContain("Add an LLM key")
  })

  it("blocks only when there is no key anywhere", () => {
    providersMock.mockReturnValue({ providers: [], platformFallback: false, isLoading: false })
    const text = renderText()
    expect(text).toContain("Add an LLM key first")
    expect(text).not.toContain("No bots yet")
  })

  it("never blocks a workspace that brought its own key", () => {
    providersMock.mockReturnValue({ providers: [KEY], platformFallback: false, isLoading: false })
    expect(renderText()).toContain("No bots yet")
  })

  it("offers the guide from the bots screen, where its first step now is", () => {
    // The only entry point used to be the machines page, whose first step was
    // "connect a machine" — unreachable without the daemon.
    providersMock.mockReturnValue({ providers: [], platformFallback: true, isLoading: false })
    expect(renderText()).toContain("Guide me")
  })

  it("hides the guide when there is genuinely no key, since it could not proceed", () => {
    providersMock.mockReturnValue({ providers: [], platformFallback: false, isLoading: false })
    expect(renderText()).not.toContain("Guide me")
  })
})
