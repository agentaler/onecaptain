import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetBotWakeContext = vi.fn();
const mockResolveAgentProvider = vi.fn();
const mockSummarizeUsage = vi.fn();
const mockGetWorkspacePlan = vi.fn();
const mockRecordUsage = vi.fn();
const mockListMessages = vi.fn();
const mockCallProvider = vi.fn();
const mockCreateCommunityMessage = vi.fn();

vi.mock("@onecaptain/shared", async () => {
  const actual = await vi.importActual<typeof import("@onecaptain/shared")>("@onecaptain/shared");
  return {
    ...actual,
    callProvider: (...a: unknown[]) => mockCallProvider(...a),
    resolveAgentProvider: (...a: unknown[]) => mockResolveAgentProvider(...a),
    queries: {
      communityBot: { getBotWakeContext: (...a: unknown[]) => mockGetBotWakeContext(...a) },
      communityMessage: { listMessages: (...a: unknown[]) => mockListMessages(...a) },
      workspace: { getWorkspacePlan: (...a: unknown[]) => mockGetWorkspacePlan(...a) },
      providerCredential: {
        summarizeUsage: (...a: unknown[]) => mockSummarizeUsage(...a),
        recordUsage: (...a: unknown[]) => mockRecordUsage(...a),
      },
    },
  };
});
vi.mock("@/lib/community/message-handler", () => ({
  createCommunityMessage: (...a: unknown[]) => mockCreateCommunityMessage(...a),
}));

import { runCloudAgentTurn } from "./cloud-agent-run";

const input = {
  db: {} as never,
  env: {},
  botUserId: "bot_1",
  channelId: "ch_1",
  serverId: "srv_1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBotWakeContext.mockResolvedValue({
    state: "ready",
    botUserId: "bot_1",
    name: "Ada",
    workspaceId: "w1",
    machineId: null,
    runtime: "cloud",
    modelName: null,
    providerKind: null,
    providerApiUrl: null,
    providerApiKeyEnc: null,
    ownerUserId: "owner_1",
  });
  mockListMessages.mockResolvedValue([
    { authorId: "human_1", authorName: "Gus", content: "hello?" },
  ]);
  mockCallProvider.mockResolvedValue({
    text: "hi",
    inputTokens: 10,
    outputTokens: 3,
    model: "m",
  });
  mockCreateCommunityMessage.mockResolvedValue({ ok: true, row: { id: "msg_1" } });
  mockGetWorkspacePlan.mockResolvedValue("free");
  mockSummarizeUsage.mockResolvedValue({ inputTokens: 0, outputTokens: 0 });
});

describe("cloud agent spend allowance", () => {
  it("refuses a platform-key run BEFORE calling the provider when over allowance", async () => {
    // Asserting `callProvider` was never invoked is the point. A test that only
    // checked the returned error would still pass if we called the provider,
    // paid for the tokens, and then reported a failure.
    mockResolveAgentProvider.mockResolvedValue({
      state: "ready",
      config: { kind: "cloud", providerId: "anthropic", apiKey: "k" },
      kind: "anthropic",
      source: "platform",
      billable: true,
    });
    mockSummarizeUsage.mockResolvedValue({ inputTokens: 99_000, outputTokens: 2_000 });

    const result = await runCloudAgentTurn(input);

    expect(result).toMatchObject({ ok: false, kind: "over_allowance" });
    expect(mockCallProvider).not.toHaveBeenCalled();
    expect(mockRecordUsage).not.toHaveBeenCalled();
  });

  it("counts input AND output tokens toward the allowance", async () => {
    // Counting only one would let a chatty agent run at roughly double the
    // intended allowance.
    mockResolveAgentProvider.mockResolvedValue({
      state: "ready",
      config: { kind: "cloud", providerId: "anthropic", apiKey: "k" },
      kind: "anthropic",
      source: "platform",
      billable: true,
    });
    mockSummarizeUsage.mockResolvedValue({ inputTokens: 60_000, outputTokens: 60_000 });

    expect((await runCloudAgentTurn(input)).ok).toBe(false);
    expect(mockCallProvider).not.toHaveBeenCalled();
  });

  it("never caps a workspace running on its own key", async () => {
    // A BYO-key call costs us nothing. Counting it against an allowance would
    // charge someone for spending their own money — which is exactly why
    // `billable` is separate from the total.
    mockResolveAgentProvider.mockResolvedValue({
      state: "ready",
      config: { kind: "cloud", providerId: "anthropic", apiKey: "k" },
      kind: "anthropic",
      source: "workspace",
      billable: false,
    });
    mockSummarizeUsage.mockResolvedValue({ inputTokens: 9_000_000, outputTokens: 9_000_000 });

    const result = await runCloudAgentTurn(input);

    expect(result.ok).toBe(true);
    expect(mockCallProvider).toHaveBeenCalled();
    // Not even consulted — the gate is skipped, not merely passed.
    expect(mockSummarizeUsage).not.toHaveBeenCalled();
  });

  it("lets a platform-key run through while under allowance", async () => {
    mockResolveAgentProvider.mockResolvedValue({
      state: "ready",
      config: { kind: "cloud", providerId: "anthropic", apiKey: "k" },
      kind: "anthropic",
      source: "platform",
      billable: true,
    });
    mockSummarizeUsage.mockResolvedValue({ inputTokens: 100, outputTokens: 100 });

    expect((await runCloudAgentTurn(input)).ok).toBe(true);
    expect(mockCallProvider).toHaveBeenCalled();
  });

  it("does not cap an enterprise workspace", async () => {
    mockGetWorkspacePlan.mockResolvedValue("enterprise");
    mockResolveAgentProvider.mockResolvedValue({
      state: "ready",
      config: { kind: "cloud", providerId: "anthropic", apiKey: "k" },
      kind: "anthropic",
      source: "platform",
      billable: true,
    });
    mockSummarizeUsage.mockResolvedValue({ inputTokens: 50_000_000, outputTokens: 0 });

    expect((await runCloudAgentTurn(input)).ok).toBe(true);
  });

  it("says why in the channel instead of going quiet, without waking anyone", async () => {
    // An agent that stops answering for an invisible reason is
    // indistinguishable from a broken one. `skipWake` is load-bearing: a bot's
    // message can wake another bot, so two over-allowance agents in one channel
    // would answer each other's notices forever.
    mockResolveAgentProvider.mockResolvedValue({
      state: "ready",
      config: { kind: "cloud", providerId: "anthropic", apiKey: "k" },
      kind: "anthropic",
      source: "platform",
      billable: true,
    });
    mockSummarizeUsage.mockResolvedValue({ inputTokens: 200_000, outputTokens: 0 });

    await runCloudAgentTurn(input);

    expect(mockCreateCommunityMessage).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: "bot_1", skipWake: true }),
    );
  });

  it("refuses a billable run for an agent with no workspace to meter", async () => {
    // No workspace means no ledger and no bill, so there is no allowance being
    // spent — that must not become a free uncapped ride on our key.
    mockGetBotWakeContext.mockResolvedValue({
      state: "ready",
      botUserId: "bot_1",
      name: "Ada",
      workspaceId: null,
      machineId: null,
      runtime: "cloud",
      modelName: null,
      providerKind: null,
      providerApiUrl: null,
      providerApiKeyEnc: null,
      ownerUserId: "owner_1",
    });
    mockResolveAgentProvider.mockResolvedValue({
      state: "ready",
      config: { kind: "cloud", providerId: "anthropic", apiKey: "k" },
      kind: "anthropic",
      source: "platform",
      billable: true,
    });

    expect((await runCloudAgentTurn(input)).ok).toBe(false);
    expect(mockCallProvider).not.toHaveBeenCalled();
  });
});
