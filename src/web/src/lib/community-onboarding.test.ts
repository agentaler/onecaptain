import { beforeEach, describe, expect, it, vi } from "vitest";

const analytics = vi.hoisted(() => ({
  started: vi.fn(),
  stageCompleted: vi.fn(),
  completed: vi.fn(),
  skipped: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  trackCommunityOnboardingStarted: analytics.started,
  trackCommunityOnboardingStageCompleted: analytics.stageCompleted,
  trackCommunityOnboardingCompleted: analytics.completed,
  trackCommunityOnboardingSkipped: analytics.skipped,
}));

import {
  advanceCommunityOnboarding,
  completeCommunityOnboarding,
  readCommunityOnboardingState,
  skipCommunityOnboarding,
  startCommunityOnboarding,
  subscribeCommunityOnboarding,
  updateCommunityOnboardingResources,
} from "./community-onboarding";

describe("community onboarding journey", () => {
  beforeEach(() => {
    skipCommunityOnboarding();
    vi.clearAllMocks();
  });

  it("starts only from an explicit trigger", () => {
    expect(readCommunityOnboardingState()).toBeNull();
    expect(startCommunityOnboarding()).toEqual({ status: "active", stage: "bot" });
    expect(startCommunityOnboarding()).toEqual({ status: "active", stage: "bot" });
    expect(analytics.started).toHaveBeenCalledOnce();
  });

  it("opens on creating a bot, not on connecting a machine", () => {
    // The regression this change exists to prevent. Step 1 used to be
    // "connect a machine", which nobody without the daemon could complete, so
    // the guide could not be finished at all.
    expect(startCommunityOnboarding()).toMatchObject({ stage: "bot" });
  });

  it("advances only from the expected real-success stage and keeps exact ids", () => {
    startCommunityOnboarding();
    advanceCommunityOnboarding("dm", "server", { dmId: "wrong" });
    expect(readCommunityOnboardingState()).toMatchObject({ stage: "bot" });
    advanceCommunityOnboarding("bot", "dm", { botId: "bot-7", dmId: "dm-4" });
    advanceCommunityOnboarding("dm", "server");
    expect(readCommunityOnboardingState()).toEqual({
      status: "active",
      stage: "server",
      botId: "bot-7",
      dmId: "dm-4",
    });
  });

  it("keeps the same companion avatar through every guide stage", () => {
    startCommunityOnboarding({ guideAvatarSeed: "guide-face-7" });
    advanceCommunityOnboarding("bot", "dm", { botId: "bot-7" });
    advanceCommunityOnboarding("dm", "server");

    expect(readCommunityOnboardingState()).toMatchObject({
      stage: "server",
      guideAvatarSeed: "guide-face-7",
    });
  });

  it("clears an explicit skip and allows manual retry", () => {
    startCommunityOnboarding();
    skipCommunityOnboarding();
    expect(readCommunityOnboardingState()).toBeNull();
    expect(analytics.skipped).toHaveBeenCalledWith("bot");
    expect(startCommunityOnboarding()).toEqual({ status: "active", stage: "bot" });
  });

  it("completes as soon as the user opens new-server creation", () => {
    startCommunityOnboarding();
    advanceCommunityOnboarding("bot", "dm");
    advanceCommunityOnboarding("dm", "server");
    completeCommunityOnboarding();
    expect(readCommunityOnboardingState()).toBeNull();
    expect(analytics.stageCompleted).toHaveBeenLastCalledWith("server");
    expect(analytics.completed).toHaveBeenCalledOnce();
    // Three stages, not four — a fourth event would mean a stage survived that
    // the user is never shown.
    expect(analytics.stageCompleted.mock.calls.map(([stage]) => stage)).toEqual([
      "bot",
      "dm",
      "server",
    ]);
  });

  it("publishes in-memory state changes to mounted consumers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCommunityOnboarding(listener);
    startCommunityOnboarding();
    advanceCommunityOnboarding("bot", "dm", { botId: "bot-7", dmId: "dm-4" });
    skipCommunityOnboarding();
    unsubscribe();
    expect(listener).toHaveBeenNthCalledWith(1, { status: "active", stage: "bot" });
    expect(listener).toHaveBeenNthCalledWith(2, {
      status: "active",
      stage: "dm",
      botId: "bot-7",
      dmId: "dm-4",
    });
    expect(listener).toHaveBeenNthCalledWith(3, null);
  });
});
